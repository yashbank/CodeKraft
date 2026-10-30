/**
 * P14-07 theme studio model: the full set of look-and-feel choices, the groups the admin picks
 * from (data, not JSX), token mapping for the scoped live preview and the site, and presets.
 */
import { PALETTES, paletteVars, type PaletteId } from "./palettes";
import type { ThemeName } from "./theme";
import {
  BUTTON_IDS,
  CARD_IDS,
  FONT_FAMILY_IDS,
  SHADOW_IDS,
  buttonLabel,
  buttonVars,
  cardLabel,
  cardVars,
  fontByIdOrUndef,
  fontStack,
  fontsHref,
  genPatternLabel,
  shadowLabel,
  shadowVars,
  type ButtonStyleId,
  type CardStyleId,
  type FontFamilyId,
  type ShadowId,
} from "./theme-catalogue";
import {
  BORDER_IDS,
  DEFAULT_UI_STYLE,
  DENSITY_IDS,
  FONT_IDS,
  FONT_LABELS,
  LAYOUT_IDS,
  LAYOUT_LABELS,
  PATTERN_IDS,
  RADIUS_IDS,
  borderValue,
  densityPad,
  patternProps,
  uiStyleVars,
  type UiStyle,
} from "./ui-style";

/** The new (additive) site_settings.theme_studio value. */
export interface StudioExtras {
  headingFont: FontFamilyId;
  bodyFont: FontFamilyId;
  shadow: ShadowId;
  button: ButtonStyleId;
  card: CardStyleId;
}
export const DEFAULT_STUDIO_EXTRAS: StudioExtras = {
  headingFont: "default",
  bodyFont: "default",
  shadow: "default",
  button: "default",
  card: "default",
};

/** Everything the studio edits at once; a preset stores one of these. */
export interface StudioValues extends UiStyle, StudioExtras {
  palette: PaletteId;
}
export const DEFAULT_STUDIO: StudioValues = {
  ...DEFAULT_UI_STYLE,
  ...DEFAULT_STUDIO_EXTRAS,
  palette: "violet",
};

export interface ThemePreset {
  name: string;
  values: StudioValues;
}
export const MAX_PRESETS = 24;

const decl = (v: Record<string, string>) =>
  Object.entries(v)
    .map(([k, x]) => `${k}:${x}`)
    .join(";");

/** Token overrides for the new groups (fonts, shadow, button, card); `{}` when all default. */
export function studioExtraVars(x: StudioExtras): Record<string, string> {
  const v: Record<string, string> = {};
  const h = fontStack(x.headingFont);
  if (h) {
    v["--ck-font-display"] = h;
    v["--ck-display-style"] = "normal";
    if (fontByIdOrUndef(x.headingFont)?.single) v["--ck-display-weight"] = "400";
  }
  const b = fontStack(x.bodyFont);
  if (b) v["--ck-font-body"] = b;
  return { ...v, ...shadowVars(x.shadow), ...buttonVars(x.button), ...cardVars(x.card) };
}

/** Site CSS for the new groups; defaults emit nothing (old data renders exactly as before). */
export function studioCss(x: StudioExtras): string {
  const v = studioExtraVars(x);
  return Object.keys(v).length ? `html[data-theme]{${decl(v)}}` : "";
}

/** `<html>` attributes that switch on the button/card rules in globals.css. */
export const studioAttrs = (x: StudioExtras) => ({
  "data-ck-btn": x.button !== "default" ? "1" : undefined,
  "data-ck-card": x.card !== "default" ? "1" : undefined,
});

/** Google Fonts stylesheet to load for the chosen heading/body fonts, or null. */
export const studioFontsHref = (x: StudioExtras) => fontsHref([x.headingFont, x.bodyFont]);

/**
 * All tokens for a scoped preview container (custom properties + kebab-case background props),
 * so the preview shows exactly what the site would after saving.
 */
export function previewVars(v: StudioValues, theme: ThemeName): Record<string, string> {
  const border = borderValue(v.border, theme);
  return {
    ...paletteVars(v.palette, theme),
    ...uiStyleVars(v),
    ...(border ? { "--ck-color-border": border } : {}),
    "--card-pad": densityPad(v.density),
    ...patternProps(v.pattern),
    ...studioExtraVars(v),
  };
}

export const studioValuesEqual = (a: StudioValues, b: StudioValues) =>
  (Object.keys(DEFAULT_STUDIO) as (keyof StudioValues)[]).every((k) => a[k] === b[k]);

/** Add (or replace by name) a preset; capped at MAX_PRESETS. Pure. */
export function addPreset(list: ThemePreset[], name: string, values: StudioValues): ThemePreset[] {
  const n = name.trim().slice(0, 40);
  if (!n) return list;
  const next = [
    ...list.filter((p) => p.name.toLowerCase() !== n.toLowerCase()),
    { name: n, values },
  ];
  return next.slice(-MAX_PRESETS);
}
export const removePreset = (list: ThemePreset[], name: string) =>
  list.filter((p) => p.name !== name);

// ---- groups (what the dropdowns render) ------------------------------------------------------
export interface StudioGroup {
  key: keyof StudioValues;
  label: string;
  /** "Changes X. See it on Y." */
  note: string;
  ids: readonly string[];
  labelOf: (id: string) => string;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fontLabel = (id: string) => {
  const f = fontByIdOrUndef(id);
  return f ? `${f.name} (${f.kind})` : "Default (from pairing)";
};
const px = (id: string, named: (s: string) => string) =>
  /^(r|pad-)\d+$/.test(id) ? `${id.replace(/^\D+/, "")}px` : named(id);

export const STUDIO_GROUPS: readonly StudioGroup[] = [
  {
    key: "palette",
    label: "Accent palette",
    note: "Changes the accent colour of buttons, links and highlights. See it on the buttons and the landing hero.",
    ids: PALETTES.map((p) => p.id),
    labelOf: (id) => PALETTES.find((p) => p.id === id)?.label ?? id,
  },
  {
    key: "font",
    label: "Font pairing",
    note: "Changes the default heading and body fonts as a matched pair. See it on the landing hero and blog card.",
    ids: FONT_IDS,
    labelOf: (id) => FONT_LABELS[id as keyof typeof FONT_LABELS] ?? id,
  },
  {
    key: "headingFont",
    label: "Heading font",
    note: "Changes the font of every heading. See it on the landing hero and dashboard widget titles.",
    ids: FONT_FAMILY_IDS,
    labelOf: fontLabel,
  },
  {
    key: "bodyFont",
    label: "Body font",
    note: "Changes the font of paragraphs, labels and form fields. See it on the blog card and the contact form.",
    ids: FONT_FAMILY_IDS,
    labelOf: fontLabel,
  },
  {
    key: "radius",
    label: "Corner radius",
    note: "Changes the corner roundness of buttons, cards and inputs. See it on product cards and the contact form.",
    ids: RADIUS_IDS,
    labelOf: (id) => px(id, (s) => (s === "soft" ? "Soft (default)" : cap(s))),
  },
  {
    key: "border",
    label: "Borders",
    note: "Changes how strong card and input outlines look. See it on product cards and form fields.",
    ids: BORDER_IDS,
    labelOf: (id) => {
      const m = /^(ink|tint)-(\d+)$/.exec(id);
      return m
        ? `${m[1] === "ink" ? "Ink" : "Tint"} ${m[2]}%`
        : id === "subtle"
          ? "Subtle (default)"
          : cap(id);
    },
  },
  {
    key: "density",
    label: "Card padding",
    note: "Changes the space inside cards. See it on product cards, blog cards and dashboard widgets.",
    ids: DENSITY_IDS,
    labelOf: (id) => px(id, (s) => (s === "normal" ? "Normal (default)" : cap(s))),
  },
  {
    key: "shadow",
    label: "Shadows",
    note: "Changes the depth shadow under cards, menus and dialogs. See it on product cards and the dashboard widget.",
    ids: SHADOW_IDS,
    labelOf: shadowLabel,
  },
  {
    key: "pattern",
    label: "Background pattern",
    note: "Changes the texture behind every page. See it on the landing hero area and page background.",
    ids: PATTERN_IDS,
    labelOf: (id) =>
      genPatternLabel(id) ??
      (id === "none" ? "None (default)" : id === "mesh" ? "Gradient mesh" : cap(id)),
  },
  {
    key: "button",
    label: "Button style",
    note: "Changes the shape, weight and depth of buttons. See it on the hero call to action and form submit button.",
    ids: BUTTON_IDS,
    labelOf: buttonLabel,
  },
  {
    key: "card",
    label: "Card style",
    note: "Changes the surface, accent edge and hover of cards. See it on product cards, blog cards and widgets.",
    ids: CARD_IDS,
    labelOf: cardLabel,
  },
  {
    key: "layout",
    label: "Site layout",
    note: "Changes how wide the page content column is. See it on the public site at desktop widths.",
    ids: LAYOUT_IDS,
    labelOf: (id) => LAYOUT_LABELS[id as keyof typeof LAYOUT_LABELS] ?? id,
  },
];
