/** Theme resolution (docs/08 §10, D-905, MASTER_SPEC §7 "Theme toggle at launch"). */
export const THEMES = ["dark-cinematic", "light-editorial"] as const;
export type ThemeName = (typeof THEMES)[number];
/** P14-12b: per-user choice also allows "auto" (follow the OS colour scheme). */
export const THEME_PREFS = [...THEMES, "auto"] as const;
export type ThemePref = (typeof THEME_PREFS)[number];
export function isThemePref(v: unknown): v is ThemePref {
  return typeof v === "string" && (THEME_PREFS as readonly string[]).includes(v);
}
/** Apply a stored pref to the document: "auto" resolves through prefers-color-scheme. */
export function applyThemePref(pref: ThemePref): void {
  const t: ThemeName =
    pref !== "auto"
      ? pref
      : matchMedia("(prefers-color-scheme: light)").matches
        ? "light-editorial"
        : "dark-cinematic";
  document.documentElement.dataset.theme = t;
  document.cookie = `${THEME_COOKIE}=${pref}; path=/; max-age=31536000; samesite=lax`;
}
export const THEME_COOKIE = "ck_theme";
export const DEFAULT_THEME: ThemeName = "dark-cinematic";
export const THEME_COLOR: Record<ThemeName, string> = {
  "dark-cinematic": "#0A0B10",
  "light-editorial": "#FAF8F3",
};

export function isThemeName(v: unknown): v is ThemeName {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

export interface ThemeInputs {
  userPref?: string | null; // users.theme_pref
  cookie?: string | null; // ck_theme
  siteDefault?: string | null; // site_settings.default_theme (P3)
  lightEnabled: boolean; // flag theme_light_editorial
}

/** Order: user pref → cookie → site default → dark-cinematic; light-editorial only when the flag is on. */
export function resolveTheme(i: ThemeInputs): ThemeName {
  const allow = (v: unknown): ThemeName | null => {
    if (!isThemeName(v)) return null;
    if (v === "light-editorial" && !i.lightEnabled) return null;
    return v;
  };
  return allow(i.userPref) ?? allow(i.cookie) ?? allow(i.siteDefault) ?? DEFAULT_THEME;
}

/**
 * ≤ 300-byte inline head script for cached public routes: applies the cookie theme before first
 * paint ("auto" follows the OS). Flag-independent so the CSP hash (middleware) is static: the
 * cookie is only written by the admin-gated toggle or the flag-gated settings action.
 */
export function inlineThemeScript(): string {
  return `(function(){try{var m=document.cookie.match(/(?:^|; )ck_theme=([^;]*)/);var t=m&&m[1];if(t==="auto")t=matchMedia("(prefers-color-scheme: light)").matches?"light-editorial":"dark-cinematic";if(t==="light-editorial"||t==="dark-cinematic")document.documentElement.dataset.theme=t}catch(e){}})();`;
}
