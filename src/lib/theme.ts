/** Theme resolution (docs/08 §10, D-905, MASTER_SPEC §7 "Theme toggle at launch"). */
export const THEMES = ["dark-cinematic", "light-editorial"] as const;
export type ThemeName = (typeof THEMES)[number];
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
 * paint. Only honours light-editorial when the flag is baked in (`L` = 1). Hash allow-listed in the CSP (P9).
 */
export function inlineThemeScript(lightEnabled: boolean): string {
  const L = lightEnabled ? 1 : 0;
  return `(function(){try{var m=document.cookie.match(/(?:^|; )ck_theme=([^;]*)/);var t=m&&m[1];if(t==="light-editorial"&&${L}||t==="dark-cinematic"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
}
