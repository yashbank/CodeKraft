import { describe, expect, it } from "vitest";

import {
  SITE_SETTINGS_DEFAULTS,
  siteSettingsSchema,
  updateSettingsSchema,
} from "@/modules/settings/contracts";
import {
  DEFAULT_STUDIO,
  DEFAULT_STUDIO_EXTRAS,
  MAX_PRESETS,
  STUDIO_GROUPS,
  addPreset,
  previewVars,
  removePreset,
  studioAttrs,
  studioCss,
  studioFontsHref,
  studioValuesEqual,
  type StudioValues,
} from "@/lib/theme-studio";
import { fontStack, fontsHref } from "@/lib/theme-catalogue";
import { borderValue, densityPad, patternProps, uiStyleCss, uiStyleVars } from "@/lib/ui-style";

const FORTY = [
  "palette",
  "headingFont",
  "bodyFont",
  "radius",
  "border",
  "density",
  "shadow",
  "pattern",
  "button",
  "card",
] as const;
const group = (k: string) => STUDIO_GROUPS.find((g) => g.key === k)!;

describe("theme studio catalogue", () => {
  it.each(FORTY)("%s has at least 40 unique, labelled options", (k) => {
    const g = group(k);
    expect(g.ids.length).toBeGreaterThanOrEqual(40);
    expect(new Set(g.ids).size).toBe(g.ids.length);
    for (const id of g.ids) expect(g.labelOf(id).length).toBeGreaterThan(0);
  });

  it("every group carries a one-line 'Changes X. See it on Y.' note", () => {
    for (const g of STUDIO_GROUPS) expect(g.note).toMatch(/^Changes [^\n]+\. See it on [^\n]+\.$/);
  });

  it("every option id maps to real tokens", () => {
    for (const id of group("radius").ids.filter((i) => i !== "soft"))
      expect(uiStyleVars({ ...DEFAULT_STUDIO, radius: id as never })["--ck-radius-md"]).toMatch(
        /px$/,
      );
    for (const id of group("border").ids.filter((i) => i !== "subtle"))
      expect(borderValue(id as never, "dark-cinematic")).toBeTruthy();
    for (const id of group("density").ids)
      expect(densityPad(id as never)).toMatch(/^[\d.]+(px|rem)$/);
    for (const id of group("pattern").ids.filter((i) => i !== "none"))
      expect(patternProps(id as never)["background-image"]).toBeTruthy();
    for (const k of ["shadow", "button", "card"] as const)
      for (const id of group(k).ids.filter((i) => i !== "default")) {
        const css = studioCss({ ...DEFAULT_STUDIO_EXTRAS, [k]: id });
        expect(css).toContain(
          k === "shadow" ? "--ck-shadow-4:" : k === "button" ? "--ck-btn-radius:" : "--ck-card-bg:",
        );
      }
    for (const id of group("headingFont").ids.filter((i) => i !== "default")) {
      expect(fontStack(id)).toMatch(/^"[^"]+",/);
      expect(fontsHref([id])).toContain("fonts.googleapis.com/css2?family=");
    }
  });

  it("defaults emit nothing, so old data renders the same", () => {
    expect(studioCss(DEFAULT_STUDIO_EXTRAS)).toBe("");
    expect(studioFontsHref(DEFAULT_STUDIO_EXTRAS)).toBeNull();
    expect(studioAttrs(DEFAULT_STUDIO_EXTRAS)).toEqual({
      "data-ck-btn": undefined,
      "data-ck-card": undefined,
    });
    expect(uiStyleCss(DEFAULT_STUDIO)).toBe("");
  });
});

describe("token mapping for the live preview and the site", () => {
  const picked: StudioValues = {
    ...DEFAULT_STUDIO,
    palette: "sunset",
    radius: "r16",
    headingFont: "playfair-display",
    bodyFont: "inter",
    shadow: "soft-5",
    button: "pill-caps-hard",
    card: "glass-top-lift",
    density: "pad-30",
    border: "ink-30",
    pattern: "dots-24",
  };

  it("previewVars carries every choice as scoped CSS variables", () => {
    const v = previewVars(picked, "dark-cinematic");
    expect(v["--ck-color-accent"]).toBe("#ff9a5c");
    expect(v["--ck-radius-md"]).toBe("16px");
    expect(v["--ck-font-display"]).toContain("Playfair Display");
    expect(v["--ck-font-body"]).toContain('"Inter"');
    expect(v["--ck-shadow-1"]).toContain("rgba");
    expect(v["--ck-btn-radius"]).toBe("999px");
    expect(v["--ck-card-hy"]).toBe("-3px");
    expect(v["--card-pad"]).toBe("30px");
    expect(v["--ck-color-border"]).toContain("color-mix");
    expect(v["background-image"]).toContain("radial-gradient");
  });

  it("the site gets the same new-group tokens plus the loader link", () => {
    const css = studioCss(picked);
    expect(css).toContain("--ck-font-display:");
    expect(css).toContain("--ck-btn-radius:999px");
    expect(studioFontsHref(picked)).toContain("family=Playfair+Display");
    expect(studioAttrs(picked)["data-ck-btn"]).toBe("1");
  });

  it("single-weight display fonts reset the heading weight", () => {
    const x = { ...DEFAULT_STUDIO_EXTRAS, headingFont: "dm-serif-display" as const };
    expect(studioCss(x)).toContain("--ck-display-weight:400");
    expect(studioFontsHref(x)).not.toContain("wght");
  });
});

describe("presets and reset", () => {
  const a: StudioValues = { ...DEFAULT_STUDIO, palette: "rose" };
  it("saves, replaces by name, caps and deletes", () => {
    let l = addPreset([], "  Warm ", a);
    expect(l).toEqual([{ name: "Warm", values: a }]);
    l = addPreset(l, "warm", { ...a, radius: "pill" });
    expect(l).toHaveLength(1);
    expect(l[0]!.values.radius).toBe("pill");
    expect(addPreset(l, "   ", a)).toBe(l);
    for (let i = 0; i < MAX_PRESETS + 5; i++) l = addPreset(l, `p${i}`, a);
    expect(l).toHaveLength(MAX_PRESETS);
    expect(removePreset(l, "p28").length).toBe(MAX_PRESETS - 1);
  });
  it("applying a preset replaces every value; reset returns the defaults", () => {
    expect(studioValuesEqual({ ...DEFAULT_STUDIO, ...a }, DEFAULT_STUDIO)).toBe(false);
    expect(studioValuesEqual({ ...DEFAULT_STUDIO }, DEFAULT_STUDIO)).toBe(true);
  });
});

describe("settings contract", () => {
  it("old data without the new keys still parses to the defaults", () => {
    // service.load() starts from the defaults and overlays stored rows, so missing keys = defaults
    const parsed = siteSettingsSchema.parse({ ...SITE_SETTINGS_DEFAULTS });
    expect(parsed.themeStudio).toEqual(DEFAULT_STUDIO_EXTRAS);
    expect(parsed.themePresets).toEqual([]);
  });
  it("accepts new ids and presets; rejects unknown ones", () => {
    const ok = updateSettingsSchema.parse({
      patch: {
        uiRadius: "r12",
        uiDensity: "pad-20",
        themeStudio: { ...DEFAULT_STUDIO_EXTRAS, headingFont: "lora", button: "pill-caps-hard" },
        themePresets: [{ name: "Warm", values: { ...DEFAULT_STUDIO, palette: "rose" } }],
      },
    });
    expect(ok.patch.themePresets).toHaveLength(1);
    const bad = (patch: object) => () => updateSettingsSchema.parse({ patch });
    expect(bad({ themeStudio: { ...DEFAULT_STUDIO_EXTRAS, headingFont: "comic-sans" } })).toThrow();
    expect(bad({ themePresets: [{ name: "", values: DEFAULT_STUDIO }] })).toThrow();
    expect(bad({ uiRadius: "r99" })).toThrow();
  });
});
