/**
 * P14-07 theme studio catalogue. Every option is data (a small spec expanded here), never JSX:
 * radius, border, padding, pattern, shadow, button and card options are generated from compact
 * tables so each group ships 40+ choices; fonts are a curated Google Fonts list loaded on demand.
 * Pure and dependency-free so it can be shared by the zod contracts, the root layout and the admin UI.
 */
const range = (from: number, to: number, step = 1): number[] => {
  const out: number[] = [];
  for (let n = from; n <= to; n += step) out.push(n);
  return out;
};
export const tuple = <T extends string>(a: readonly T[]) => a as unknown as readonly [T, ...T[]];

// ---- radius: `r<md px>`; the six steps keep the ratios of the named "round" scale -------------
export const RADIUS_GEN_IDS = range(0, 40).map((n) => `r${n}` as const);
export type GenRadiusId = (typeof RADIUS_GEN_IDS)[number];
const RADIUS_RATIO = [0.5, 0.75, 1, 1.4, 1.75, 2.25];
/** px for xs, sm, md, lg, xl, 2xl of a generated radius id. */
export const genRadiusScale = (id: string): number[] | undefined => {
  const m = /^r(\d+)$/.exec(id);
  return m ? RADIUS_RATIO.map((r) => Math.round(Number(m[1]) * r)) : undefined;
};

// ---- borders: `ink-<n>` (text colour) and `tint-<n>` (accent) mixed into the canvas at n% ------
const MIX = [3, 5, 7, 9, 12, 15, 18, 21, 24, 27, 30, 34, 38, 42, 46, 50, 55, 60, 70, 80];
export const BORDER_GEN_IDS = [
  ...MIX.map((n) => `ink-${n}`),
  ...MIX.map((n) => `tint-${n}`),
] as const;
export type GenBorderId = (typeof BORDER_GEN_IDS)[number];
export const genBorderValue = (id: string): string | undefined => {
  const m = /^(ink|tint)-(\d+)$/.exec(id);
  return m
    ? `color-mix(in srgb,var(${m[1] === "ink" ? "--ck-color-fg" : "--ck-color-accent"}) ${m[2]}%,var(--ck-color-canvas))`
    : undefined;
};

// ---- card padding: `pad-<px>` ----------------------------------------------------------------
export const PAD_GEN_IDS = range(8, 47).map((n) => `pad-${n}` as const);
export type GenPadId = (typeof PAD_GEN_IDS)[number];
export const genPad = (id: string): string | undefined => {
  const m = /^pad-(\d+)$/.exec(id);
  return m ? `${m[1]}px` : undefined;
};

// ---- background patterns: `<family>-<size|angle>` --------------------------------------------
const FG = "var(--ck-color-fg)";
const ACC = "var(--ck-color-accent)";
const mix = (c: string, p: number) => `color-mix(in srgb,${c} ${p}%,transparent)`;
const GLOW: Record<string, string> = {
  tl: "12% 8%",
  tr: "88% 8%",
  bl: "12% 92%",
  br: "88% 92%",
  top: "50% 0%",
  bottom: "50% 100%",
  center: "50% 40%",
};
const PATTERN_FAMILIES = {
  dots: [10, 14, 18, 24, 32, 40],
  grid: [12, 16, 20, 24, 32, 40, 48, 64],
  stripes: range(0, 165, 15),
  checker: [16, 24, 32, 48, 64],
  crosshatch: [16, 24, 32, 48],
  glow: Object.keys(GLOW),
} as const;
export const PATTERN_GEN_IDS = Object.entries(PATTERN_FAMILIES).flatMap(([f, vs]) =>
  vs.map((v) => `${f}-${v}`),
);
const PATTERN_FAMILY_LABEL: Record<string, string> = {
  dots: "Dots",
  grid: "Grid",
  stripes: "Stripes",
  checker: "Checker",
  crosshatch: "Crosshatch",
  glow: "Glow",
};
export const genPatternLabel = (id: string): string | undefined => {
  const [f, v] = id.split("-");
  return f && v && PATTERN_FAMILY_LABEL[f]
    ? `${PATTERN_FAMILY_LABEL[f]} ${/^\d+$/.test(v) ? `${v}${f === "stripes" ? "°" : "px"}` : v}`
    : undefined;
};
/** CSS properties (kebab-case) for a generated pattern id. */
export function genPatternProps(id: string): Record<string, string> | undefined {
  const [f, v = ""] = id.split("-");
  const n = Number(v);
  const ok =
    f &&
    f in PATTERN_FAMILIES &&
    (PATTERN_FAMILIES as Record<string, readonly (string | number)[]>)[f]?.map(String).includes(v);
  if (!ok) return undefined;
  const size = `${n}px ${n}px`;
  switch (f) {
    case "dots":
      return {
        "background-image": `radial-gradient(${mix(FG, 10)} 1px,transparent 1.5px)`,
        "background-size": size,
      };
    case "grid":
      return {
        "background-image": `linear-gradient(${mix(FG, 5)} 1px,transparent 1px),linear-gradient(90deg,${mix(FG, 5)} 1px,transparent 1px)`,
        "background-size": size,
      };
    case "stripes":
      return {
        "background-image": `repeating-linear-gradient(${n}deg,${mix(FG, 6)} 0 1px,transparent 1px 16px)`,
      };
    case "checker":
      return {
        "background-image": `conic-gradient(${mix(FG, 5)} 25%,transparent 0 50%,${mix(FG, 5)} 0 75%,transparent 0)`,
        "background-size": size,
      };
    case "crosshatch":
      return {
        "background-image": `repeating-linear-gradient(45deg,${mix(FG, 5)} 0 1px,transparent 1px ${n}px),repeating-linear-gradient(-45deg,${mix(FG, 5)} 0 1px,transparent 1px ${n}px)`,
      };
    default:
      return {
        "background-image": `radial-gradient(circle at ${GLOW[v]},${mix(ACC, 22)},transparent 55%)`,
      };
  }
}

// ---- shadows: `<family>-<1..10>` rewrite --ck-shadow-1..4 -------------------------------------
const SHADOW_FAMILIES = ["soft", "crisp", "tint", "glow"] as const;
export const SHADOW_GEN_IDS = SHADOW_FAMILIES.flatMap((f) => range(1, 10).map((i) => `${f}-${i}`));
export const SHADOW_IDS = tuple(["default", "none", ...SHADOW_GEN_IDS]);
export type ShadowId = (typeof SHADOW_IDS)[number];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const shadowLabel = (id: string) =>
  id === "default" ? "Default (theme)" : id === "none" ? "None" : cap(id.replace("-", " "));
/** `--ck-shadow-1..4` for a shadow id (`{}` for the theme default). */
export function shadowVars(id: ShadowId): Record<string, string> {
  if (id === "default") return {};
  const out: Record<string, string> = {};
  const [f, lvl] = id.split("-");
  const i = Number(lvl);
  [1, 2, 3, 4].forEach((k) => {
    let v = "none";
    if (id !== "none") {
      const y = Math.round(k * i * 0.8 * 10) / 10;
      const blur = Math.round(k * i * 2.4 * 10) / 10;
      const alpha = Math.min(0.55, 0.06 + i * 0.04);
      if (f === "soft") v = `0 ${y}px ${blur}px rgba(0,0,0,${alpha.toFixed(2)})`;
      else if (f === "crisp") v = `${y / 2}px ${y / 2}px 0 ${mix(FG, Math.min(60, 8 + i * 5))}`;
      else if (f === "tint") v = `0 ${y}px ${blur}px ${mix(ACC, Math.min(60, 8 + i * 5))}`;
      else v = `0 0 ${blur}px ${mix(ACC, Math.min(70, 12 + i * 6))}`;
    }
    out[`--ck-shadow-${k}`] = v;
  });
  return out;
}

// ---- buttons: shape x type x elevation --------------------------------------------------------
const BTN_SHAPE = { square: "0px", slight: "4px", rounded: "8px", soft: "14px", pill: "999px" };
const BTN_TYPE = {
  regular: { w: "600", c: "none", t: "0" },
  bold: { w: "800", c: "none", t: "0" },
  caps: { w: "700", c: "uppercase", t: "0.06em" },
  wide: { w: "600", c: "uppercase", t: "0.16em" },
};
const BTN_ELEV = {
  flat: "none",
  soft: "0 3px 8px rgba(0,0,0,.28)",
  hard: `3px 3px 0 ${mix(FG, 75)}`,
};
export const BUTTON_IDS = tuple([
  "default",
  ...Object.keys(BTN_SHAPE).flatMap((s) =>
    Object.keys(BTN_TYPE).flatMap((t) => Object.keys(BTN_ELEV).map((e) => `${s}-${t}-${e}`)),
  ),
]);
export type ButtonStyleId = (typeof BUTTON_IDS)[number];
export const buttonLabel = (id: string) =>
  id === "default" ? "Default (theme)" : id.split("-").map(cap).join(" · ");
/** Button token overrides; consumed by `[data-ck-btn] [data-slot=button]` in globals.css. */
export function buttonVars(id: ButtonStyleId): Record<string, string> {
  const [s, t, e] = id.split("-") as [
    keyof typeof BTN_SHAPE,
    keyof typeof BTN_TYPE,
    keyof typeof BTN_ELEV,
  ];
  if (!BTN_SHAPE[s] || !BTN_TYPE[t] || !BTN_ELEV[e]) return {};
  return {
    "--ck-btn-radius": BTN_SHAPE[s],
    "--ck-btn-weight": BTN_TYPE[t].w,
    "--ck-btn-case": BTN_TYPE[t].c,
    "--ck-btn-track": BTN_TYPE[t].t,
    "--ck-btn-shadow": BTN_ELEV[e],
  };
}

// ---- cards: surface x accent edge x hover -----------------------------------------------------
const CARD_SURFACE = {
  flat: { bg: "var(--ck-color-surface)", bc: "transparent", sh: "none", blur: "none" },
  outline: {
    bg: "var(--ck-color-canvas)",
    bc: "var(--ck-color-border-strong)",
    sh: "none",
    blur: "none",
  },
  raised: {
    bg: "var(--ck-color-surface)",
    bc: "var(--ck-color-border)",
    sh: "var(--ck-shadow-3)",
    blur: "none",
  },
  tinted: {
    bg: "var(--ck-color-accent-soft)",
    bc: "var(--ck-color-border)",
    sh: "none",
    blur: "none",
  },
  glass: {
    bg: "color-mix(in srgb,var(--ck-color-surface) 55%,transparent)",
    bc: "var(--ck-color-border)",
    sh: "var(--ck-shadow-2)",
    blur: "blur(10px)",
  },
  bold: { bg: "var(--ck-color-surface)", bc: "var(--ck-color-fg)", sh: "none", blur: "none" },
};
const CARD_EDGE = {
  plain: "0 0 #0000",
  top: "inset 0 3px 0 var(--ck-color-accent)",
  left: "inset 3px 0 0 var(--ck-color-accent)",
  bottom: "inset 0 -3px 0 var(--ck-color-accent)",
};
const CARD_HOVER = { still: "0px", lift: "-3px" };
export const CARD_IDS = tuple([
  "default",
  ...Object.keys(CARD_SURFACE).flatMap((s) =>
    Object.keys(CARD_EDGE).flatMap((e) => Object.keys(CARD_HOVER).map((h) => `${s}-${e}-${h}`)),
  ),
]);
export type CardStyleId = (typeof CARD_IDS)[number];
export const cardLabel = (id: string) =>
  id === "default" ? "Default (theme)" : id.split("-").map(cap).join(" · ");
/** Card token overrides; consumed by `[data-ck-card] [data-slot=card]` in globals.css. */
export function cardVars(id: CardStyleId): Record<string, string> {
  const [s, e, h] = id.split("-") as [
    keyof typeof CARD_SURFACE,
    keyof typeof CARD_EDGE,
    keyof typeof CARD_HOVER,
  ];
  if (!CARD_SURFACE[s] || !CARD_EDGE[e] || !CARD_HOVER[h]) return {};
  return {
    "--ck-card-bg": CARD_SURFACE[s].bg,
    "--ck-card-bc": CARD_SURFACE[s].bc,
    "--ck-card-sh": CARD_SURFACE[s].sh,
    "--ck-card-blur": CARD_SURFACE[s].blur,
    "--ck-card-edge": CARD_EDGE[e],
    "--ck-card-hy": CARD_HOVER[h],
  };
}

// ---- fonts: curated Google Fonts, loaded on demand (only the chosen ones are requested) -------
type Kind = "sans" | "serif" | "mono" | "display";
// [family, kind, single-weight]
const FONT_ROWS: readonly (readonly [string, Kind, boolean?])[] = [
  ["Inter", "sans"],
  ["Roboto", "sans"],
  ["Open Sans", "sans"],
  ["Lato", "sans"],
  ["Montserrat", "sans"],
  ["Poppins", "sans"],
  ["Nunito", "sans"],
  ["Raleway", "sans"],
  ["Work Sans", "sans"],
  ["DM Sans", "sans"],
  ["Manrope", "sans"],
  ["Plus Jakarta Sans", "sans"],
  ["Outfit", "sans"],
  ["Sora", "sans"],
  ["Lexend", "sans"],
  ["Rubik", "sans"],
  ["Archivo", "sans"],
  ["Figtree", "sans"],
  ["Space Grotesk", "sans"],
  ["IBM Plex Sans", "sans"],
  ["Karla", "sans"],
  ["Mulish", "sans"],
  ["Barlow", "sans"],
  ["Cabin", "sans"],
  ["Quicksand", "sans"],
  ["Josefin Sans", "sans"],
  ["Public Sans", "sans"],
  ["Red Hat Display", "sans"],
  ["Albert Sans", "sans"],
  ["Be Vietnam Pro", "sans"],
  ["Urbanist", "sans"],
  ["Epilogue", "sans"],
  ["Inter Tight", "sans"],
  ["Heebo", "sans"],
  ["Noto Sans", "sans"],
  ["Source Sans 3", "sans"],
  ["Fira Sans", "sans"],
  ["Ubuntu", "sans"],
  ["Titillium Web", "sans"],
  ["Libre Franklin", "sans"],
  ["Syne", "sans"],
  ["Bricolage Grotesque", "sans"],
  ["Onest", "sans"],
  ["Schibsted Grotesk", "sans"],
  ["Playfair Display", "serif"],
  ["Merriweather", "serif"],
  ["Lora", "serif"],
  ["Source Serif 4", "serif"],
  ["Newsreader", "serif"],
  ["Crimson Pro", "serif"],
  ["Libre Baskerville", "serif"],
  ["Cormorant Garamond", "serif"],
  ["EB Garamond", "serif"],
  ["PT Serif", "serif"],
  ["Spectral", "serif"],
  ["Bitter", "serif"],
  ["Fraunces", "serif"],
  ["Noto Serif", "serif"],
  ["Zilla Slab", "serif"],
  ["Roboto Slab", "serif"],
  ["DM Serif Display", "serif", true],
  ["Instrument Serif", "serif", true],
  ["Abril Fatface", "display", true],
  ["Bebas Neue", "display", true],
  ["Anton", "display", true],
  ["Oswald", "display"],
  ["JetBrains Mono", "mono"],
  ["Space Mono", "mono"],
  ["IBM Plex Mono", "mono"],
  ["Fira Code", "mono"],
  ["Roboto Mono", "mono"],
  ["DM Mono", "mono"],
];
const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-");
export const GOOGLE_FONTS = FONT_ROWS.map(([name, kind, single]) => ({
  id: slug(name),
  name,
  kind,
  single: !!single,
}));
export const FONT_FAMILY_IDS = tuple(["default", ...GOOGLE_FONTS.map((f) => f.id)]);
export type FontFamilyId = (typeof FONT_FAMILY_IDS)[number];
const FALLBACK: Record<Kind, string> = {
  sans: "ui-sans-serif,system-ui,sans-serif",
  serif: "ui-serif,Georgia,serif",
  mono: "ui-monospace,monospace",
  display: "ui-sans-serif,system-ui,sans-serif",
};
export const fontByIdOrUndef = (id: string) => GOOGLE_FONTS.find((f) => f.id === id);
/** CSS `font-family` value for a catalogue font id (`undefined` for "default"). */
export const fontStack = (id: string): string | undefined => {
  const f = fontByIdOrUndef(id);
  return f ? `"${f.name}",${FALLBACK[f.kind]}` : undefined;
};
/** One Google Fonts stylesheet URL for the chosen ids (`null` when none need loading). */
export function fontsHref(ids: readonly string[]): string | null {
  const fams = [...new Set(ids)]
    .map(fontByIdOrUndef)
    .filter((f): f is NonNullable<typeof f> => !!f)
    .map((f) => `family=${f.name.replace(/ /g, "+")}${f.single ? "" : ":wght@400;700"}`);
  return fams.length ? `https://fonts.googleapis.com/css2?${fams.join("&")}&display=swap` : null;
}
