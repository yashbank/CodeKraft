/** Admin-selectable site-wide accent palettes. Applied as `[data-palette]` overrides of the accent tokens. */
import { THEMES, type ThemeName } from "./theme";

// [label, accent on the dark canvas, accent on the light canvas (also the solid fill, white text)]
const RAW = {
  violet: ["Violet", "#9d8fff", "#3f35d6"],
  ocean: ["Ocean", "#5eb8ff", "#0b5cad"],
  emerald: ["Emerald", "#3ddc97", "#0a7a4b"],
  amber: ["Amber", "#f5b53d", "#8a5300"],
  rose: ["Rose", "#ff7a9c", "#b8174a"],
  coral: ["Coral", "#ff8a65", "#b43c14"],
  teal: ["Teal", "#2dd4cf", "#0b6e6a"],
  slate: ["Slate", "#a3b1d6", "#41507a"],
  sunset: ["Sunset", "#ff9a5c", "#a8420a"],
  crimson: ["Crimson", "#ff6b6b", "#b3202a"],
  lime: ["Lime", "#a3e635", "#3f6212"],
  mint: ["Mint", "#6ee7b7", "#0f766e"],
  sky: ["Sky", "#7dd3fc", "#0369a1"],
  indigo: ["Indigo", "#8c9bff", "#3730a3"],
  fuchsia: ["Fuchsia", "#f088ff", "#a21caf"],
  gold: ["Gold", "#e8c547", "#7a5b00"],
  graphite: ["Graphite", "#c4c8d4", "#3d4350"],
  forest: ["Forest", "#7bd88f", "#166534"],
  plum: ["Plum", "#d79bff", "#7e22ce"],
  copper: ["Copper", "#e0a07a", "#8f4a1c"],
  cherry: ["Cherry", "#f04c67", "#cd1d3b"],
  peach: ["Peach", "#f0834c", "#ae4b19"],
  lavender: ["Lavender", "#9668f3", "#7c48e5"],
  cyan: ["Cyan", "#4ce0f0", "#127681"],
  aqua: ["Aqua", "#4cf0db", "#11786b"],
  olive: ["Olive", "#c7f04c", "#5b7411"],
  moss: ["Moss", "#90f04c", "#3c7811"],
  rust: ["Rust", "#f0754c", "#bb431b"],
  brick: ["Brick", "#f0594c", "#c92b1d"],
  wine: ["Wine", "#f04c9e", "#c91d73"],
  navy: ["Navy", "#5079f1", "#325ee2"],
  cobalt: ["Cobalt", "#4c90f0", "#1d67cd"],
  azure: ["Azure", "#4cacf0", "#186daa"],
  orchid: ["Orchid", "#d54cf0", "#b01dcd"],
  magenta: ["Magenta", "#f04cd5", "#c01ba4"],
  blush: ["Blush", "#f04c75", "#cd1d49"],
  honey: ["Honey", "#f0ba4c", "#8a6314"],
  citrine: ["Citrine", "#f0e34c", "#746c11"],
  pine: ["Pine", "#4cf09e", "#117845"],
  jade: ["Jade", "#4cf0ba", "#117856"],
  steel: ["Steel", "#4c9ef0", "#1b6bbb"],
  ember: ["Ember", "#f0994c", "#a15717"],
  tangerine: ["Tangerine", "#f0a44c", "#985b16"],
  lilac: ["Lilac", "#b055f1", "#9832e2"],
  seafoam: ["Seafoam", "#4cf083", "#117834"],
  berry: ["Berry", "#f04cba", "#c41c8c"],
} as const;

export const PALETTE_IDS = Object.keys(RAW) as [keyof typeof RAW, ...(keyof typeof RAW)[]];
export type PaletteId = (typeof PALETTE_IDS)[number];
export const DEFAULT_PALETTE: PaletteId = "violet";

export const PALETTES = PALETTE_IDS.map((id) => ({
  id,
  label: RAW[id][0],
  dark: RAW[id][1],
  light: RAW[id][2],
}));

export const PALETTE_CANVAS: Record<ThemeName, string> = {
  "dark-cinematic": "#0a0b10",
  "light-editorial": "#faf8f3",
};

/** Accent token overrides for a palette on a theme (`{}` for the default palette). */
export function paletteVars(id: PaletteId, t: ThemeName): Record<string, string> {
  const p = PALETTES.find((x) => x.id === id);
  if (!p || id === DEFAULT_PALETTE) return {};
  const dark = t === "dark-cinematic";
  const a = dark ? p.dark : p.light;
  return {
    "--ck-color-accent": a,
    "--ck-color-accent-text": a,
    "--ck-color-accent-fg": dark ? PALETTE_CANVAS[t] : "#ffffff",
    "--ck-color-accent-solid": p.light,
    "--ck-color-accent-hover": `color-mix(in srgb,${a} 85%,${dark ? "#fff" : "#000"})`,
    "--ck-color-accent-active": `color-mix(in srgb,${a} 85%,#000)`,
    "--ck-color-accent-soft": `color-mix(in srgb,${a} 14%,${PALETTE_CANVAS[t]})`,
  };
}

/** CSS for the chosen palette; the default palette needs none (tokens already are violet). */
export function paletteCss(id: PaletteId): string {
  if (id === DEFAULT_PALETTE || !PALETTES.some((x) => x.id === id)) return "";
  return THEMES.map(
    (t) =>
      `[data-palette="${id}"][data-theme="${t}"]{${Object.entries(paletteVars(id, t))
        .map(([k, v]) => `${k}:${v}`)
        .join(";")}}`,
  ).join("");
}
