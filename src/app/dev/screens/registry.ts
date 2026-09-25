/**
 * Screen preview registry (dev only). Each entry maps a designed screen (ui/screens/**) to its
 * preview route under /dev/screens. Agents append entries for the screens they build.
 */
export interface ScreenEntry {
  id: string; // SCR-SITE-01 …
  title: string;
  href: string; // /dev/screens/site/landing
  group: "site" | "auth" | "account" | "admin";
  spec: string; // ui/screens/... path
}

export const SCREENS: ScreenEntry[] = [
  // --- site (agent A appends)
  // --- auth + account + checkout (agent B appends)
  // --- admin (agent C appends)
];
