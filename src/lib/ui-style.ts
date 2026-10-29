/** Admin-selectable typography, shape and background pattern (P11-01). Applied as `html[data-*]` overrides of existing tokens. */
import { THEMES } from "./theme";

const SERIF = "ui-serif, Georgia, serif";
const SANS = "ui-sans-serif, system-ui, sans-serif";
// id → [label, display var, display fallback, body var, body fallback, display weight override]
const FONTS_RAW = {
  default: ["Default (theme)", "", "", "", "", ""],
  "fraunces-tight": [
    "Fraunces + Inter Tight",
    "--font-fraunces",
    SERIF,
    "--font-inter-tight",
    SANS,
    "",
  ],
  "grotesk-plex": [
    "Space Grotesk + IBM Plex Sans",
    "--font-space-grotesk",
    SANS,
    "--font-ibm-plex",
    SANS,
    "",
  ],
  "instrument-geist": [
    "Instrument Serif + Geist",
    "--font-instrument-serif",
    SERIF,
    "--font-geist",
    SANS,
    "400",
  ],
  "syne-manrope": ["Syne + Manrope", "--font-syne", SANS, "--font-manrope", SANS, ""],
  "bricolage-dm": [
    "Bricolage Grotesque + DM Sans",
    "--font-bricolage",
    SANS,
    "--font-dm-sans",
    SANS,
    "",
  ],
} as const;
export const FONT_IDS = Object.keys(FONTS_RAW) as [
  keyof typeof FONTS_RAW,
  ...(keyof typeof FONTS_RAW)[],
];
export type FontId = (typeof FONT_IDS)[number];
export const FONT_LABELS = Object.fromEntries(
  FONT_IDS.map((id) => [id, FONTS_RAW[id][0]]),
) as Record<FontId, string>;

export const RADIUS_IDS = ["sharp", "soft", "round"] as const;
export type RadiusId = (typeof RADIUS_IDS)[number];
export const BORDER_IDS = ["subtle", "defined"] as const;
export type BorderId = (typeof BORDER_IDS)[number];
export const PATTERN_IDS = ["none", "grid", "dots", "noise", "mesh"] as const;
export type PatternId = (typeof PATTERN_IDS)[number];

export interface UiStyle {
  font: FontId;
  radius: RadiusId;
  border: BorderId;
  pattern: PatternId;
}
export const DEFAULT_UI_STYLE: UiStyle = {
  font: "default",
  radius: "soft",
  border: "subtle",
  pattern: "none",
};

// px for xs, sm, md, lg, xl, 2xl ("soft" = the theme's own values, no override)
const RADII = {
  sharp: [0, 1, 2, 3, 4, 6],
  round: [8, 12, 16, 22, 28, 36],
} as const;
const SIZES = ["xs", "sm", "md", "lg", "xl", "2xl"];
const DEFINED_BORDER = { "dark-cinematic": "#3b4157", "light-editorial": "#c8c3b4" } as const;

const fg = "var(--ck-color-fg)";
const accent = "var(--ck-color-accent)";
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.06'/%3E%3C/svg%3E\")";
const PATTERN_BG: Record<Exclude<PatternId, "none">, Record<string, string>> = {
  grid: {
    "background-image": `linear-gradient(color-mix(in srgb,${fg} 5%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,${fg} 5%,transparent) 1px,transparent 1px)`,
    "background-size": "32px 32px",
  },
  dots: {
    "background-image": `radial-gradient(color-mix(in srgb,${fg} 9%,transparent) 1px,transparent 1.5px)`,
    "background-size": "20px 20px",
  },
  noise: { "background-image": NOISE },
  mesh: {
    "background-image": `radial-gradient(at 12% 8%,color-mix(in srgb,${accent} 14%,transparent),transparent 45%),radial-gradient(at 88% 18%,color-mix(in srgb,${accent} 8%,transparent),transparent 40%),radial-gradient(at 50% 100%,color-mix(in srgb,${accent} 10%,transparent),transparent 50%)`,
  },
};
/** Pattern as CSS properties (kebab-case) — `{}` for none. */
export const patternProps = (id: PatternId): Record<string, string> =>
  id === "none" ? {} : PATTERN_BG[id];

/** Font + radius token overrides for the chosen options (kebab-case custom properties). */
export function uiStyleVars(o: UiStyle): Record<string, string> {
  const v: Record<string, string> = {};
  const f = FONTS_RAW[o.font];
  if (o.font !== "default") {
    v["--ck-font-display"] = `var(${f[1]}),${f[2]}`;
    v["--ck-font-body"] = `var(${f[3]}),${f[4]}`;
    if (f[5]) {
      v["--ck-display-weight"] = f[5];
      v["--ck-display-style"] = "normal";
    }
  }
  if (o.radius !== "soft")
    SIZES.forEach((s, i) => (v[`--ck-radius-${s}`] = `${RADII[o.radius as "sharp"][i]}px`));
  return v;
}
const decl = (v: Record<string, string>) =>
  Object.entries(v)
    .map(([k, x]) => `${k}:${x}`)
    .join(";");

/** Global CSS for the chosen options; defaults emit nothing. */
export function uiStyleCss(o: UiStyle): string {
  let css = "";
  const vars = uiStyleVars(o);
  if (o.font !== "default") {
    css += `html[data-font="${o.font}"]{${decl(Object.fromEntries(Object.entries(vars).filter(([k]) => !k.includes("radius"))))}}`;
  }
  if (o.radius !== "soft") {
    css += `html[data-radius="${o.radius}"]{${decl(Object.fromEntries(Object.entries(vars).filter(([k]) => k.includes("radius"))))}}`;
  }
  if (o.border === "defined") {
    css += THEMES.map(
      (t) =>
        `html[data-border="defined"][data-theme="${t}"]{--ck-color-border:${DEFINED_BORDER[t]}}`,
    ).join("");
  }
  if (o.pattern !== "none") {
    css +=
      `html[data-pattern="${o.pattern}"] body{${decl(patternProps(o.pattern))};background-attachment:fixed}` +
      `@media (prefers-contrast:more),(prefers-reduced-transparency:reduce){html[data-pattern] body{background-image:none}}`;
  }
  return css;
}
