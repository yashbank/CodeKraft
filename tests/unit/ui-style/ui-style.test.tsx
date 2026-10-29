import { describe, expect, it, vi } from "vitest";

import { DEFAULT_UI_STYLE, FONT_IDS, PATTERN_IDS, uiStyleCss, type UiStyle } from "@/lib/ui-style";
import { updateSettingsSchema } from "@/modules/settings/contracts";

describe("ui-style", () => {
  it("settings schema accepts known ids only", () => {
    const ok = updateSettingsSchema.parse({
      patch: { uiFont: "syne-manrope", uiRadius: "round", uiBorder: "defined", uiPattern: "dots" },
    });
    expect(ok.patch.uiRadius).toBe("round");
    for (const bad of [
      { uiFont: "comic" },
      { uiRadius: "blob" },
      { uiBorder: "thick" },
      { uiPattern: "zigzag" },
    ]) {
      expect(() => updateSettingsSchema.parse({ patch: bad })).toThrow();
    }
  });

  it("defaults emit no CSS", () => {
    expect(uiStyleCss(DEFAULT_UI_STYLE)).toBe("");
  });

  it.each(FONT_IDS.filter((f) => f !== "default"))("font %s sets both font vars", (font) => {
    const css = uiStyleCss({ ...DEFAULT_UI_STYLE, font });
    expect(css).toContain(`html[data-font="${font}"]`);
    expect(css).toContain("--ck-font-display:");
    expect(css).toContain("--ck-font-body:");
  });

  it("radius and border map to tokens", () => {
    expect(uiStyleCss({ ...DEFAULT_UI_STYLE, radius: "sharp" })).toContain("--ck-radius-md:2px");
    expect(uiStyleCss({ ...DEFAULT_UI_STYLE, radius: "round" })).toContain("--ck-radius-md:16px");
    expect(uiStyleCss({ ...DEFAULT_UI_STYLE, border: "defined" })).toContain("--ck-color-border:");
  });

  it.each(PATTERN_IDS.filter((p) => p !== "none"))("pattern %s emits background CSS", (pattern) => {
    const css = uiStyleCss({ ...DEFAULT_UI_STYLE, pattern });
    expect(css).toContain(`html[data-pattern="${pattern}"] body{background-image:`);
    expect(css).toContain("prefers-reduced-transparency");
  });

  it("root layout emits data attributes and CSS", async () => {
    vi.resetModules();
    vi.doMock("@/lib/fonts", () => ({ fontVariables: "" }));
    const ui: UiStyle = {
      font: "bricolage-dm",
      radius: "round",
      border: "defined",
      pattern: "grid",
      layout: "standard",
      density: "normal",
    };
    vi.doMock("@/lib/site-brand", () => ({
      getSiteName: async () => "CodeKraft",
      getSiteLogo: async () => null,
      getThemeConfig: async () => ({
        defaultTheme: "dark-cinematic",
        themeToggle: true,
        palette: "violet",
        ui,
      }),
    }));
    const { default: RootLayout } = await import("@/app/layout");
    const el = await RootLayout({ children: null });
    expect(el.props["data-font"]).toBe("bricolage-dm");
    expect(el.props["data-radius"]).toBe("round");
    expect(el.props["data-border"]).toBe("defined");
    expect(el.props["data-pattern"]).toBe("grid");
    expect(JSON.stringify(el.props.children)).toContain("html[data-pattern=");
  });
});
