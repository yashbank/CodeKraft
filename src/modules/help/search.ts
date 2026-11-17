/**
 * Local BM25 search over help guides. Zero cost, no network. Contract:
 * searchHelp(query, role, locale) -> { hits: [{ id, title, body, score }] }.
 * `score` is normalised to 0..1 (share of the best achievable BM25 for the query terms), so one
 * threshold works for any corpus size.
 */
import { knowledgeEntries, type HelpLocale, type HelpRole, type KnowledgeEntry } from "./knowledge";

export type { HelpLocale, HelpRole, KnowledgeEntry };
export interface HelpHit {
  id: string;
  title: string;
  body: string;
  score: number;
  links?: { label: string; path: string }[];
}

const K1 = 1.2;
const B = 0.5;
const TITLE_W = 3;
const KEYWORD_W = 2;
const TOP_N = 3;

const STOP = new Set(
  (
    "a an the is are was were be to of in on at for and or do does did how what when where why i me my " +
    "can could should would will it this that with from by as if so we you your please " +
    "है हैं था थी थे का की के में से को और या क्या कैसे कब कहाँ कहां मैं मेरा मेरी मेरे कर करें करना सकता सकती सकते पर यह वह एक"
  ).split(/\s+/),
);

/** Light English stemmer: plural / -ing / -ed / -ly. Devanagari tokens are left whole. */
export function stem(tok: string): string {
  if (!/^[a-z]+$/.test(tok) || tok.length < 5) return tok;
  for (const [suf, min] of [
    ["ies", 3],
    ["ing", 4],
    ["ed", 4],
    ["es", 4],
    ["ly", 4],
    ["s", 4],
  ] as const) {
    if (tok.endsWith(suf) && tok.length - suf.length >= min) {
      const base = tok.slice(0, -suf.length);
      if (suf === "es" && !/(s|x|z|ch|sh)$/.test(base)) continue;
      return suf === "ies" ? base + "y" : base;
    }
  }
  return tok;
}

export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of text
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)) {
    if (raw.length === 0 || STOP.has(raw)) continue;
    out.push(stem(raw));
  }
  return out;
}

const ROLE_VISIBLE: Record<HelpRole, readonly HelpRole[]> = {
  customer: ["customer"],
  partner: ["partner", "customer"],
  staff: ["staff", "customer"],
  admin: ["admin", "staff", "customer", "partner"],
  super_admin: ["super_admin", "admin", "staff", "customer", "partner"],
};

/** One entry per id: requested locale wins, English is the fallback. */
function pool(
  entries: readonly KnowledgeEntry[],
  role: HelpRole,
  locale: HelpLocale,
): KnowledgeEntry[] {
  const visible = new Set(ROLE_VISIBLE[role] ?? ROLE_VISIBLE.customer);
  const byId = new Map<string, KnowledgeEntry>();
  for (const e of entries) {
    if (!e.roles.some((r) => visible.has(r))) continue;
    if (e.locale !== locale && e.locale !== "en") continue;
    const cur = byId.get(e.id);
    if (!cur || (e.locale === locale && cur.locale !== locale)) byId.set(e.id, e);
  }
  return [...byId.values()];
}

export function searchHelp(
  query: string,
  role: HelpRole,
  locale: HelpLocale,
  entries: readonly KnowledgeEntry[] = knowledgeEntries,
  topN: number = TOP_N,
): { hits: HelpHit[] } {
  const terms = [...new Set(tokenize(query))];
  const candidates = pool(entries, role, locale);
  if (terms.length === 0 || candidates.length === 0) return { hits: [] };

  const docs = candidates.map((entry) => {
    const tf = new Map<string, number>();
    const add = (text: string, w: number) => {
      for (const t of tokenize(text)) tf.set(t, (tf.get(t) ?? 0) + w);
    };
    add(entry.title, TITLE_W);
    add(entry.keywords.join(" "), KEYWORD_W);
    add(entry.body, 1);
    let len = 0;
    for (const v of tf.values()) len += v;
    return { entry, tf, len };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avgLen = docs.reduce((a, d) => a + d.len, 0) / docs.length;
  const n = docs.length;
  const idf = (t: string) => {
    const d = df.get(t) ?? 0;
    return Math.log(1 + (n - d + 0.5) / (d + 0.5));
  };

  let maxScore = 0;
  for (const t of terms) maxScore += idf(t) * (K1 + 1);
  const hits: HelpHit[] = [];
  for (const doc of docs) {
    let s = 0;
    for (const t of terms) {
      const f = doc.tf.get(t);
      if (!f) continue;
      s += (idf(t) * f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.len) / avgLen));
    }
    if (s > 0) {
      hits.push({
        id: doc.entry.id,
        title: doc.entry.title,
        body: doc.entry.body,
        score: Math.min(1, s / maxScore),
        ...(doc.entry.links ? { links: doc.entry.links } : {}),
      });
    }
  }
  hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return { hits: hits.slice(0, topN) };
}

/** Best-matching paragraphs of a guide, in original order, capped at `maxChars`. */
export function pickSnippet(body: string, query: string, maxChars: number): string {
  const terms = new Set(tokenize(query));
  const paras = body
    .split(/\n{2,}|\n(?=[-*#\d])/)
    .map((p) => p.trim())
    .filter(Boolean);
  const scored = paras.map((p, i) => ({
    p,
    i,
    s: tokenize(p).filter((t) => terms.has(t)).length - i * 0.001,
  }));
  scored.sort((a, b) => b.s - a.s);
  const chosen: typeof scored = [];
  let used = 0;
  for (const c of scored) {
    if (used + c.p.length > maxChars) {
      if (chosen.length === 0) chosen.push({ ...c, p: c.p.slice(0, maxChars) });
      continue;
    }
    chosen.push(c);
    used += c.p.length + 1;
  }
  return chosen
    .sort((a, b) => a.i - b.i)
    .map((c) => c.p)
    .join("\n");
}
