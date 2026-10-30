/**
 * Per-section style for landing chapters (P14-08). Stored in `landing_chapters.media.style` (no
 * migration). Enums only — no raw CSS ever reaches the DOM: `sectionStyleCss` maps each enum to a
 * fixed declaration, and an absent/default value emits nothing so untouched sections render as before.
 */
import type { CSSProperties } from "react";
import { z } from "zod";

import { FONT_IDS, FONT_LABELS, uiStyleVars, DEFAULT_UI_STYLE } from "@/lib/ui-style";

export const SCALE = ["xs", "sm", "md", "lg", "xl"] as const;
export const SECTION_BORDERS = ["none", "subtle", "strong", "accent", "dashed"] as const;
export const SECTION_TONES = ["raised", "sunken", "accent"] as const;

export const sectionStyleSchema = z.strictObject({
  font: z.enum(FONT_IDS).optional(),
  border: z.enum(SECTION_BORDERS).optional(),
  padY: z.enum(SCALE).optional(),
  padX: z.enum(SCALE).optional(),
  gap: z.enum(SCALE).optional(),
  tone: z.enum(SECTION_TONES).optional(),
});
export type SectionStyle = z.infer<typeof sectionStyleSchema>;
export { FONT_IDS, FONT_LABELS };

const PAD_Y = { xs: "1.5rem", sm: "3rem", md: "5rem", lg: "7rem", xl: "10rem" } as const;
// min(…, vw) keeps the extra side padding from squeezing content on phones.
const PAD_X = {
  xs: "min(0.5rem,2vw)",
  sm: "min(1rem,4vw)",
  md: "min(2rem,6vw)",
  lg: "min(3rem,8vw)",
  xl: "min(4rem,10vw)",
} as const;
const GAP = { xs: "0.5rem", sm: "1rem", md: "1.5rem", lg: "2.5rem", xl: "4rem" } as const;
const BORDER = {
  none: "0",
  subtle: "1px solid var(--ck-color-border)",
  strong: "2px solid var(--ck-color-border-strong)",
  accent: "2px solid color-mix(in srgb,var(--ck-color-accent) 55%,var(--ck-color-canvas))",
  dashed: "2px dashed var(--ck-color-border-strong)",
} as const;
const TONE = {
  raised: "var(--ck-color-surface)",
  sunken: "color-mix(in srgb,var(--ck-color-fg) 5%,var(--ck-color-canvas))",
  accent: "color-mix(in srgb,var(--ck-color-accent) 10%,var(--ck-color-canvas))",
} as const;

/** Validate a stored value; anything malformed is dropped (renders as an unstyled section). */
export function parseSectionStyle(raw: unknown): SectionStyle | undefined {
  const r = sectionStyleSchema.safeParse(raw);
  return r.success ? r.data : undefined;
}

/** Inline style for a section; `{}` when nothing is set. */
export function sectionStyleCss(s: SectionStyle | null | undefined): CSSProperties {
  if (!s) return {};
  const o: Record<string, string> = {};
  if (s.font && s.font !== "default") {
    Object.assign(o, uiStyleVars({ ...DEFAULT_UI_STYLE, font: s.font }));
    // body inherits a computed font-family, so re-point it at the overridden variable here.
    o.fontFamily = "var(--ck-font-body)";
  }
  if (s.padY) o.paddingBlock = PAD_Y[s.padY];
  if (s.padX) o.paddingInline = PAD_X[s.padX];
  if (s.gap) o["--sec-gap"] = GAP[s.gap];
  if (s.border) o.borderBlock = BORDER[s.border];
  if (s.tone) o.backgroundColor = TONE[s.tone];
  return o as CSSProperties;
}
