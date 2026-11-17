/** STUB (P21-2): replaced by the knowledge agent (qa/p21-1-knowledge). Interface only. */
export type HelpRole = "customer" | "partner" | "staff" | "admin" | "super_admin";
export type HelpLocale = "en" | "hi";

export interface KnowledgeEntry {
  id: string;
  title: string;
  roles: readonly HelpRole[];
  keywords: readonly string[];
  body: string;
  locale: HelpLocale;
}

export const knowledgeEntries: readonly KnowledgeEntry[] = [];
