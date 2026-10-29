import { describe, expect, it, vi } from "vitest";

import { PALETTES, PALETTE_CANVAS, paletteCss } from "@/lib/palettes";
import { siteSettingsSchema, updateSettingsSchema } from "@/modules/settings/contracts";

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe("palettes", () => {
  it("has the R9-08 palette catalogue (16+)", () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(16);
  });

  it.each(PALETTES)("$id accent meets WCAG AA on both canvases and under its button text", (p) => {
    expect(ratio(p.dark, PALETTE_CANVAS["dark-cinematic"])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p.light, PALETTE_CANVAS["light-editorial"])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(PALETTE_CANVAS["dark-cinematic"], p.dark)).toBeGreaterThanOrEqual(4.5);
    expect(ratio("#ffffff", p.light)).toBeGreaterThanOrEqual(4.5);
  });

  it("emits overrides for a non-default palette only", () => {
    expect(paletteCss("violet")).toBe("");
    expect(paletteCss("ocean")).toContain('[data-palette="ocean"][data-theme="dark-cinematic"]');
  });

  it("settings schema accepts palette ids and rejects unknown", () => {
    const ok = updateSettingsSchema.parse({ patch: { palette: "rose", themeToggle: false } });
    expect(ok.patch.palette).toBe("rose");
    expect(() => updateSettingsSchema.parse({ patch: { palette: "neon" } })).toThrow();
    expect(siteSettingsSchema.shape.palette.safeParse("nope").success).toBe(false);
  });

  it("root layout applies the chosen palette attribute", async () => {
    vi.resetModules();
    vi.doMock("@/lib/fonts", () => ({ fontVariables: "" }));
    vi.doMock("@/lib/site-brand", () => ({
      getSiteName: async () => "CodeKraft",
      getSiteLogo: async () => null,
      getThemeConfig: async () => ({
        defaultTheme: "light-editorial",
        themeToggle: true,
        palette: "teal",
        ui: {
          font: "default",
          radius: "soft",
          border: "subtle",
          pattern: "none",
          layout: "standard",
          density: "normal",
        },
      }),
    }));
    const { default: RootLayout } = await import("@/app/layout");
    const el = await RootLayout({ children: null });
    expect(el.props["data-palette"]).toBe("teal");
    expect(el.props["data-theme"]).toBe("light-editorial");
  });
});
