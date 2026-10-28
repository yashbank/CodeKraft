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

/** CSS for the chosen palette; the default palette needs none (tokens already are violet). */
export function paletteCss(id: PaletteId): string {
  const p = PALETTES.find((x) => x.id === id);
  if (!p || id === DEFAULT_PALETTE) return "";
  return THEMES.map((t) => {
    const dark = t === "dark-cinematic";
    const a = dark ? p.dark : p.light;
    return (
      `[data-palette="${id}"][data-theme="${t}"]{--ck-color-accent:${a};--ck-color-accent-text:${a};` +
      `--ck-color-accent-fg:${dark ? PALETTE_CANVAS[t] : "#ffffff"};--ck-color-accent-solid:${p.light};` +
      `--ck-color-accent-hover:color-mix(in srgb,${a} 85%,${dark ? "#fff" : "#000"});` +
      `--ck-color-accent-active:color-mix(in srgb,${a} 85%,#000);` +
      `--ck-color-accent-soft:color-mix(in srgb,${a} 14%,${PALETTE_CANVAS[t]})}`
    );
  }).join("");
}
