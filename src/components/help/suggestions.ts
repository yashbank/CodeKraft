import type { HelpLocale, HelpRole, Suggestions } from "./types";

export const DEFAULT_SUGGESTIONS: Suggestions = {
  en: [
    "How do I download my purchase?",
    "How can I pay for an order?",
    "Where can I see my invoices?",
    "How do I contact support?",
  ],
  hi: [
    "मैं अपनी खरीद कैसे डाउनलोड करूँ?",
    "ऑर्डर का भुगतान कैसे करूँ?",
    "मेरे इनवॉइस कहाँ दिखेंगे?",
    "सपोर्ट से कैसे संपर्क करूँ?",
  ],
};

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

/**
 * Tolerant reader for knowledge/suggestions.json. Accepts a string[], {en,hi}, or the same keyed by
 * role ({customer:{en,hi}}). Anything else falls back to the built-in defaults per locale.
 */
export function normalizeSuggestions(raw: unknown, role: HelpRole): Suggestions {
  const pick = (node: unknown, loc: HelpLocale): string[] => {
    if (Array.isArray(node)) return loc === "en" ? strings(node) : [];
    if (node && typeof node === "object") return strings((node as Record<string, unknown>)[loc]);
    return [];
  };
  const root = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
  const scoped = root ? ((root as Record<string, unknown>)[role] ?? root) : raw;
  const out: Suggestions = { en: [], hi: [] };
  for (const loc of ["en", "hi"] as const) {
    const list = pick(scoped, loc).slice(0, 6);
    out[loc] = list.length ? list : DEFAULT_SUGGESTIONS[loc];
  }
  return out;
}
