/**
 * Help knowledge base. Guides live as markdown in ./knowledge/<locale>/*.md and are compiled into
 * knowledge.generated.json by `pnpm help:build` (a unit test fails when the JSON is stale). Using a
 * static JSON import keeps this module bundler-safe on Vercel serverless: no fs reads at runtime.
 */
import generated from "./knowledge.generated.json";
import suggestionData from "./knowledge/suggestions.json";

export type HelpLocale = "en" | "hi";
export type HelpRole = "customer" | "partner" | "staff" | "admin" | "super_admin";

export interface KnowledgeEntry {
  id: string;
  title: string;
  roles: HelpRole[];
  keywords: string[];
  body: string;
}

const DATA = generated as Record<HelpLocale, KnowledgeEntry[]>;

/** All guides for a locale (falls back to English for unknown locales). */
export function getKnowledge(locale: HelpLocale = "en"): readonly KnowledgeEntry[] {
  return DATA[locale] ?? DATA.en;
}

/** Guides visible to a role. Anonymous visitors should be passed as "customer". */
export function getKnowledgeForRole(role: HelpRole, locale: HelpLocale = "en"): KnowledgeEntry[] {
  return getKnowledge(locale).filter((e) => e.roles.includes(role));
}

export function getGuide(id: string, locale: HelpLocale = "en"): KnowledgeEntry | undefined {
  return getKnowledge(locale).find((e) => e.id === id);
}

export type SuggestionRole = HelpRole | "guest";

/** Suggested starter questions for a role; "guest" is the signed-out visitor. */
export function getSuggestions(role: SuggestionRole, locale: HelpLocale = "en"): readonly string[] {
  const lists = suggestionData as Record<SuggestionRole, Record<HelpLocale, string[]>>;
  return (lists[role] ?? lists.guest)[locale] ?? lists.guest.en;
}
