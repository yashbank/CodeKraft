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
  return {
    id: scalar("id"),
    title: scalar("title"),
    roles: list("roles") as HelpRole[],
    keywords: list("keywords"),
    body: (m[2] ?? "").trim(),
  };
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
