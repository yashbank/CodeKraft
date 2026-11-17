export type HelpRole = "customer" | "partner" | "staff" | "admin" | "super_admin";
export type HelpLocale = "en" | "hi";
export type HelpMode = "guide" | "ai" | "search" | "off";

export interface HelpSource {
  id: string;
  title: string;
  /** Optional app path; only same-site "/..." paths are ever linked. */
  path?: string;
}

export interface HelpLink {
  label: string;
  /** Same-site path; "/admin/<screen>" means the admin host. */
  path: string;
}
export interface HelpRelated {
  id: string;
  title: string;
}

export interface AskResponse {
  answer: string;
  sources: HelpSource[];
  mode: HelpMode;
  links?: HelpLink[];
  related?: HelpRelated[];
}

export type Suggestions = Record<HelpLocale, string[]>;

export const MAX_QUERY = 300;
