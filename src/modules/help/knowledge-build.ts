/**
 * Build-time helper (Node only, never imported by app code): parses
 * src/modules/help/knowledge/<locale>/*.md into the entries stored in knowledge.generated.json.
 * Run `pnpm help:build` after editing any guide. A unit test fails when the JSON is stale.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const HELP_LOCALES = ["en", "hi"] as const;
export type HelpLocale = (typeof HELP_LOCALES)[number];
export const HELP_ROLES = ["customer", "partner", "staff", "admin", "super_admin"] as const;
export type HelpRole = (typeof HELP_ROLES)[number];

export interface KnowledgeEntry {
  id: string;
  title: string;
  roles: HelpRole[];
  keywords: string[];
  body: string;
  /** Optional "open this screen" targets (frontmatter `links:`), omitted when a guide has none. */
  links?: GuideLink[];
}
export interface GuideLink {
  label: string;
  path: string;
}
export type KnowledgeData = Record<HelpLocale, KnowledgeEntry[]>;

export const KNOWLEDGE_DIR = path.join(process.cwd(), "src/modules/help/knowledge");

function unquote(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      return JSON.parse(s) as string;
    } catch {
      return s.slice(1, -1);
    }
  }
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  return s;
}

/** Splits a flow-sequence body on commas that are not inside double quotes. */
function splitList(inner: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner.charAt(i);
    if (ch === '"' && inner[i - 1] !== "\\") inQuote = !inQuote;
    if (ch === "," && !inQuote) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map(unquote).filter((x) => x.length > 0);
}

export function parseGuide(raw: string, file: string): KnowledgeEntry {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const fm = m[1] ?? "";
  const scalar = (key: string): string => {
    const r = new RegExp(`^${key}:[ \\t]*(.+)$`, "m").exec(fm);
    if (!r) throw new Error(`${file}: frontmatter key "${key}" missing`);
    return unquote(r[1] ?? "");
  };
  const list = (key: string): string[] => {
    const r = new RegExp(`^${key}:[ \\t]*\\[([\\s\\S]*?)\\]`, "m").exec(fm);
    if (!r) throw new Error(`${file}: frontmatter list "${key}" missing`);
    return splitList(r[1] ?? "");
  };
  const links = parseLinks(fm, file);
  return {
    id: scalar("id"),
    title: scalar("title"),
    roles: list("roles") as HelpRole[],
    keywords: list("keywords"),
    body: (m[2] ?? "").trim(),
    ...(links.length > 0 ? { links } : {}),
  };
}

/**
 * Optional block in the frontmatter:
 *   links:
 *     - label: Leads
 *       path: /admin/leads
 * Absent for older guides. Every item needs a label and a path starting with "/".
 */
function parseLinks(fm: string, file: string): GuideLink[] {
  const lines = fm.split(/\r?\n/);
  const start = lines.findIndex((l) => /^links:[ \t]*$/.test(l));
  if (start === -1) return [];
  const out: GuideLink[] = [];
  let cur: Partial<GuideLink> | null = null;
  const flush = () => {
    if (!cur) return;
    if (!cur.label || !cur.path || !cur.path.startsWith("/"))
      throw new Error(`${file}: each link needs a label and a path starting with "/"`);
    out.push({ label: cur.label, path: cur.path });
    cur = null;
  };
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") continue;
    if (!/^[ \t]/.test(line)) break;
    const item = /^[ \t]*-[ \t]+(label|path):[ \t]*(.+)$/.exec(line);
    const field = /^[ \t]+(label|path):[ \t]*(.+)$/.exec(line);
    if (item) {
      flush();
      cur = {};
      cur[item[1] as "label" | "path"] = unquote(item[2] ?? "");
    } else if (field && cur) {
      cur[field[1] as "label" | "path"] = unquote(field[2] ?? "");
    } else throw new Error(`${file}: cannot parse links line "${line.trim()}"`);
  }
  flush();
  return out;
}

export function buildKnowledge(dir: string = KNOWLEDGE_DIR): KnowledgeData {
  const out = { en: [], hi: [] } as KnowledgeData;
  for (const locale of HELP_LOCALES) {
    const files = readdirSync(path.join(dir, locale))
      .filter((f) => f.endsWith(".md"))
      .sort();
    for (const f of files) {
      out[locale].push(
        parseGuide(readFileSync(path.join(dir, locale, f), "utf8"), `${locale}/${f}`),
      );
    }
  }
  return out;
}
