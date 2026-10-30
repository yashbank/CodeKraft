/** Admin-selectable typography, shape and background pattern (P11-01). Applied as `html[data-*]` overrides of existing tokens. */
import { THEMES, type ThemeName } from "./theme";
import {
  BORDER_GEN_IDS,
  PAD_GEN_IDS,
  PATTERN_GEN_IDS,
  RADIUS_GEN_IDS,
  genBorderValue,
  genPad,
  genPatternProps,
  genRadiusScale,
  tuple,
  type GenBorderId,
  type GenPadId,
  type GenRadiusId,
} from "./theme-catalogue";

const SERIF = "ui-serif, Georgia, serif";
const SANS = "ui-sans-serif, system-ui, sans-serif";
// family key → [css var, fallback]
const FAM = {
  fraunces: ["--font-fraunces", SERIF],
  interTight: ["--font-inter-tight", SANS],
  grotesk: ["--font-space-grotesk", SANS],
  plex: ["--font-ibm-plex", SANS],
  instrument: ["--font-instrument-serif", SERIF],
  geist: ["--font-geist", SANS],
  syne: ["--font-syne", SANS],
  manrope: ["--font-manrope", SANS],
  bricolage: ["--font-bricolage", SANS],
  dmSans: ["--font-dm-sans", SANS],
  inter: ["--font-inter", SANS],
  mono: ["--font-jetbrains-mono", "ui-monospace, monospace"],
  playfair: ["--font-playfair", SERIF],
  dmSerif: ["--font-dm-serif", SERIF],
  newsreader: ["--font-newsreader", SERIF],
  sourceSerif: ["--font-source-serif", SERIF],
  poppins: ["--font-poppins", SANS],
  montserrat: ["--font-montserrat", SANS],
  workSans: ["--font-work-sans", SANS],
  outfit: ["--font-outfit", SANS],
  jakarta: ["--font-jakarta", SANS],
  sora: ["--font-sora", SANS],
  lexend: ["--font-lexend", SANS],
  rubik: ["--font-rubik", SANS],
  archivo: ["--font-archivo", SANS],
  figtree: ["--font-figtree", SANS],
} as const;
type Fam = keyof typeof FAM;
// id → [label, display family, body family, display weight override]
const PAIRS = {
  "fraunces-tight": ["Fraunces + Inter Tight", "fraunces", "interTight", ""],
  "grotesk-plex": ["Space Grotesk + IBM Plex Sans", "grotesk", "plex", ""],
  "instrument-geist": ["Instrument Serif + Geist", "instrument", "geist", "400"],
  "syne-manrope": ["Syne + Manrope", "syne", "manrope", ""],
  "bricolage-dm": ["Bricolage Grotesque + DM Sans", "bricolage", "dmSans", ""],
  "playfair-worksans": ["Playfair Display + Work Sans", "playfair", "workSans", ""],
  "dmserif-dmsans": ["DM Serif Display + DM Sans", "dmSerif", "dmSans", "400"],
  "newsreader-inter": ["Newsreader + Inter", "newsreader", "inter", ""],
  "sourceserif-plex": ["Source Serif 4 + IBM Plex Sans", "sourceSerif", "plex", ""],
  poppins: ["Poppins", "poppins", "poppins", ""],
  "montserrat-worksans": ["Montserrat + Work Sans", "montserrat", "workSans", ""],
  "outfit-inter": ["Outfit + Inter", "outfit", "inter", ""],
  jakarta: ["Plus Jakarta Sans", "jakarta", "jakarta", ""],
  "sora-manrope": ["Sora + Manrope", "sora", "manrope", ""],
  "lexend-inter": ["Lexend + Inter", "lexend", "inter", ""],
  rubik: ["Rubik", "rubik", "rubik", ""],
  archivo: ["Archivo", "archivo", "archivo", ""],
  "figtree-geist": ["Figtree + Geist", "figtree", "geist", ""],
  geist: ["Geist", "geist", "geist", ""],
  "mono-inter": ["JetBrains Mono + Inter", "mono", "inter", ""],
} as const satisfies Record<string, readonly [string, Fam, Fam, string]>;
type FontRow = readonly [string, string, string, string, string, string];
const FONTS_RAW: Record<string, FontRow> & { default: FontRow } = {
  default: ["Default (theme)", "", "", "", "", ""],
  ...Object.fromEntries(
    Object.entries(PAIRS).map(([id, [l, d, b, w]]) => [
      id,
      [l, FAM[d][0], FAM[d][1], FAM[b][0], FAM[b][1], w] as const,
    ]),
  ),
};
export const FONT_IDS = ["default", ...Object.keys(PAIRS)] as [
  "default",
  ...(keyof typeof PAIRS)[],
];
export type FontId = (typeof FONT_IDS)[number];
export const FONT_LABELS = Object.fromEntries(
  FONT_IDS.map((id) => [id, FONTS_RAW[id]?.[0] ?? id]),
) as Record<FontId, string>;

const RADIUS_NAMED = ["sharp", "crisp", "soft", "smooth", "round", "pill"] as const;
export type RadiusId = (typeof RADIUS_NAMED)[number] | GenRadiusId;
export const RADIUS_IDS = tuple<RadiusId>([...RADIUS_NAMED, ...RADIUS_GEN_IDS]);
const BORDER_NAMED = ["subtle", "defined", "strong", "faint", "accent", "ink"] as const;
export type BorderId = (typeof BORDER_NAMED)[number] | GenBorderId;
export const BORDER_IDS = tuple<BorderId>([...BORDER_NAMED, ...BORDER_GEN_IDS]);
const PATTERN_NAMED = [
  "none",
  "grid",
  "dots",
  "noise",
  "mesh",
  "diagonal",
  "lines",
  "checker",
  "plus",
] as const;
export type PatternId = (typeof PATTERN_NAMED)[number] | (typeof PATTERN_GEN_IDS)[number];
export const PATTERN_IDS = tuple<PatternId>([...PATTERN_NAMED, ...PATTERN_GEN_IDS]);
export const LAYOUT_IDS = ["standard", "compact", "wide", "focused"] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];
// [label, site column max at xl, at 2xl]; standard = Container's built-in 1320/1440
const LAYOUTS = {
  standard: ["Standard", "", ""],
  compact: ["Compact", "1120px", "1200px"],
  wide: ["Wide", "1440px", "1680px"],
  focused: ["Focused", "960px", "1040px"],
} as const;
export const LAYOUT_WIDTH = { standard: 1320, compact: 1120, wide: 1440, focused: 960 } as const;
export const LAYOUT_LABELS = Object.fromEntries(
  LAYOUT_IDS.map((id) => [id, LAYOUTS[id][0]]),
) as Record<LayoutId, string>;

/** Inline picker list: the current id plus up to two popular ones (never more than 3). */
export function inlineIds<T extends string>(
  current: T,
  popular: readonly T[],
  all: readonly T[],
): T[] {
  return [current, ...popular.filter((p) => p !== current && all.includes(p))].slice(0, 3);
}

const DENSITY_NAMED = ["compact", "normal", "comfortable"] as const;
export type DensityId = (typeof DENSITY_NAMED)[number] | GenPadId;
export const DENSITY_IDS = tuple<DensityId>([...DENSITY_NAMED, ...PAD_GEN_IDS]);
/** Card padding per density → `--card-pad`; normal = the components' built-in 1.5rem (no override). */
export const DENSITY_PAD: Record<(typeof DENSITY_NAMED)[number], string> = {
  compact: "1rem",
  normal: "1.5rem",
  comfortable: "2rem",
};
export const densityPad = (id: DensityId): string =>
  DENSITY_PAD[id as keyof typeof DENSITY_PAD] ?? genPad(id) ?? DENSITY_PAD.normal;

export interface UiStyle {
  font: FontId;
  radius: RadiusId;
  border: BorderId;
  pattern: PatternId;
  layout: LayoutId;
  density: DensityId;
}
export const DEFAULT_UI_STYLE: UiStyle = {
  font: "default",
  radius: "soft",
  border: "subtle",
  pattern: "none",
  layout: "standard",
  density: "normal",
};

// px for xs, sm, md, lg, xl, 2xl ("soft" = the theme's own values, no override)
const RADII = {
  sharp: [0, 1, 2, 3, 4, 6],
  crisp: [1, 2, 4, 6, 8, 12],
  smooth: [4, 6, 10, 14, 18, 26],
  round: [8, 12, 16, 22, 28, 36],
  pill: [12, 18, 24, 32, 40, 56],
} as const;
const SIZES = ["xs", "sm", "md", "lg", "xl", "2xl"];
const DEFINED_BORDER = { "dark-cinematic": "#3b4157", "light-editorial": "#c8c3b4" } as const;
// Other border styles are theme-agnostic mixes of existing tokens (never self-referencing).
const BORDER_MIX: Record<string, string> = {
  strong: "var(--ck-color-border-strong)",
  faint: "color-mix(in srgb,var(--ck-color-fg) 8%,var(--ck-color-canvas))",
  accent: "color-mix(in srgb,var(--ck-color-accent) 45%,var(--ck-color-canvas))",
  ink: "color-mix(in srgb,var(--ck-color-fg) 40%,var(--ck-color-canvas))",
};

/** `--ck-color-border` value for a border style on a theme (`undefined` = the theme's own). */
export const borderValue = (b: BorderId, t: ThemeName): string | undefined =>
  b === "subtle"
    ? undefined
    : b === "defined"
      ? DEFINED_BORDER[t]
      : (BORDER_MIX[b] ?? genBorderValue(b));

const fg = "var(--ck-color-fg)";
const accent = "var(--ck-color-accent)";
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.06'/%3E%3C/svg%3E\")";
const PLUS =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cpath d='M16 12v8M12 16h8' stroke='%23888' stroke-opacity='.22' stroke-width='1'/%3E%3C/svg%3E\")";
const PATTERN_BG: Record<
  Exclude<(typeof PATTERN_NAMED)[number], "none">,
  Record<string, string>
> = {
  grid: {
    "background-image": `linear-gradient(color-mix(in srgb,${fg} 5%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,${fg} 5%,transparent) 1px,transparent 1px)`,
    "background-size": "32px 32px",
  },
  dots: {
    "background-image": `radial-gradient(color-mix(in srgb,${fg} 9%,transparent) 1px,transparent 1.5px)`,
    "background-size": "20px 20px",
  },
  noise: { "background-image": NOISE },
  diagonal: {
    "background-image": `repeating-linear-gradient(45deg,color-mix(in srgb,${fg} 6%,transparent) 0 1px,transparent 1px 14px)`,
  },
  lines: {
    "background-image": `repeating-linear-gradient(0deg,color-mix(in srgb,${fg} 5%,transparent) 0 1px,transparent 1px 24px)`,
  },
  checker: {
    "background-image": `conic-gradient(color-mix(in srgb,${fg} 5%,transparent) 25%,transparent 0 50%,color-mix(in srgb,${fg} 5%,transparent) 0 75%,transparent 0)`,
    "background-size": "40px 40px",
  },
  plus: { "background-image": PLUS, "background-size": "32px 32px" },
  mesh: {
    "background-image": `radial-gradient(at 12% 8%,color-mix(in srgb,${accent} 14%,transparent),transparent 45%),radial-gradient(at 88% 18%,color-mix(in srgb,${accent} 8%,transparent),transparent 40%),radial-gradient(at 50% 100%,color-mix(in srgb,${accent} 10%,transparent),transparent 50%)`,
  },
};
/** Pattern as CSS properties (kebab-case) — `{}` for none. */
export const patternProps = (id: PatternId): Record<string, string> =>
  id === "none" ? {} : (PATTERN_BG[id as keyof typeof PATTERN_BG] ?? genPatternProps(id) ?? {});

/** Font + radius token overrides for the chosen options (kebab-case custom properties). */
export function uiStyleVars(o: UiStyle): Record<string, string> {
  const v: Record<string, string> = {};
  const f = FONTS_RAW[o.font] ?? FONTS_RAW.default;
  if (o.font !== "default") {
    v["--ck-font-display"] = `var(${f[1]}),${f[2]}`;
    v["--ck-font-body"] = `var(${f[3]}),${f[4]}`;
    if (f[5]) {
      v["--ck-display-weight"] = f[5];
      v["--ck-display-style"] = "normal";
    }
  }
  const scale = RADII[o.radius as keyof typeof RADII] ?? genRadiusScale(o.radius);
  if (o.radius !== "soft" && scale)
    SIZES.forEach((s, i) => (v[`--ck-radius-${s}`] = `${scale[i]}px`));
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
  if (o.border !== "subtle") {
    css += THEMES.map(
      (t) =>
        `html[data-border="${o.border}"][data-theme="${t}"]{--ck-color-border:${borderValue(o.border, t)}}`,
    ).join("");
  }
  if (o.density !== "normal") {
    css += `html[data-density="${o.density}"]{--card-pad:${densityPad(o.density)}}`;
  }
  if (o.layout !== "standard") {
    const [, xl, xxl] = LAYOUTS[o.layout];
    css += `html[data-layout="${o.layout}"]{--ck-site-w:${xl};--ck-site-w-2xl:${xxl}}`;
  }
  if (o.pattern !== "none") {
    css +=
      `html[data-pattern="${o.pattern}"] body{${decl(patternProps(o.pattern))};background-attachment:fixed}` +
      `@media (prefers-contrast:more),(prefers-reduced-transparency:reduce){html[data-pattern] body{background-image:none}}`;
  }
  return css;
}
