import { describe, expect, it } from "vitest";

import { PALETTES, PALETTE_CANVAS, paletteCss } from "@/lib/palettes";
import {
  BORDER_IDS,
  DEFAULT_UI_STYLE,
  DENSITY_IDS,
  FONT_IDS,
  LAYOUT_IDS,
  PATTERN_IDS,
  RADIUS_IDS,
  inlineIds,
  uiStyleCss,
} from "@/lib/ui-style";
import { updateSettingsSchema } from "@/modules/settings/contracts";

const lum = (h: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

describe("R9-08 ui options", () => {
  it("has the requested option counts", () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(16);
    expect(FONT_IDS.length).toBeGreaterThanOrEqual(20);
    expect(BORDER_IDS.length).toBe(6);
    expect(RADIUS_IDS.length).toBe(6);
    expect(PATTERN_IDS.length).toBeGreaterThanOrEqual(8);
    expect(LAYOUT_IDS.length).toBe(4);
  });

  it.each(PALETTES)("palette $id passes WCAG AA (text on canvas, white on solid)", (p) => {
    expect(contrast(p.dark, PALETTE_CANVAS["dark-cinematic"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.light, PALETTE_CANVAS["light-editorial"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.light, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    if (p.id !== "violet") expect(paletteCss(p.id)).toContain(`[data-palette="${p.id}"]`);
  });

  it("every option id maps to tokens", () => {
    for (const font of FONT_IDS.filter((f) => f !== "default"))
      expect(uiStyleCss({ ...DEFAULT_UI_STYLE, font })).toContain(`data-font="${font}"`);
    for (const radius of RADIUS_IDS.filter((r) => r !== "soft"))
      expect(uiStyleCss({ ...DEFAULT_UI_STYLE, radius })).toContain("--ck-radius-md:");
    for (const border of BORDER_IDS.filter((b) => b !== "subtle"))
      expect(uiStyleCss({ ...DEFAULT_UI_STYLE, border })).toContain(`data-border="${border}"`);
    for (const pattern of PATTERN_IDS.filter((p) => p !== "none"))
      expect(uiStyleCss({ ...DEFAULT_UI_STYLE, pattern })).toContain("background-image:");
    for (const layout of LAYOUT_IDS.filter((l) => l !== "standard"))
      expect(uiStyleCss({ ...DEFAULT_UI_STYLE, layout })).toContain("--ck-site-w:");
  });

  it("card padding density maps to --card-pad; normal emits nothing", () => {
    expect(uiStyleCss(DEFAULT_UI_STYLE)).toBe("");
    expect(uiStyleCss({ ...DEFAULT_UI_STYLE, density: "compact" })).toContain("--card-pad:1rem");
    expect(uiStyleCss({ ...DEFAULT_UI_STYLE, density: "comfortable" })).toContain(
      "--card-pad:2rem",
    );
    expect(DENSITY_IDS).toEqual(["compact", "normal", "comfortable"]);
  });

  it("inline list shows at most 3 and includes the current one", () => {
    const all = ["a", "b", "c", "d", "e"];
    expect(inlineIds("d", ["a", "b", "c"], all)).toEqual(["d", "a", "b"]);
    expect(inlineIds("a", ["a", "b", "c"], all)).toEqual(["a", "b", "c"]);
    expect(inlineIds("e", [], all)).toEqual(["e"]);
  });

  it("settings schema accepts new options and still defaults", () => {
    const ok = updateSettingsSchema.parse({
      patch: {
        uiFont: "playfair-worksans",
        palette: "sunset",
        uiRadius: "pill",
        uiBorder: "ink",
        uiPattern: "plus",
        uiLayout: "wide",
        uiDensity: "compact",
      },
    });
    expect(ok.patch.uiFont).toBe("playfair-worksans");
    expect(() => updateSettingsSchema.parse({ patch: { uiLayout: "huge" } })).toThrow();
  });
});
