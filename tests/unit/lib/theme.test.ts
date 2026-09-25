import { describe, expect, it } from "vitest";

import { inlineThemeScript, resolveTheme } from "@/lib/theme";

describe("resolveTheme (docs/08 §10)", () => {
  it("follows user pref → cookie → site default → dark", () => {
    expect(resolveTheme({ lightEnabled: true })).toBe("dark-cinematic");
    expect(resolveTheme({ siteDefault: "light-editorial", lightEnabled: true })).toBe(
      "light-editorial",
    );
    expect(
      resolveTheme({
        cookie: "dark-cinematic",
        siteDefault: "light-editorial",
        lightEnabled: true,
      }),
    ).toBe("dark-cinematic");
    expect(
      resolveTheme({ userPref: "light-editorial", cookie: "dark-cinematic", lightEnabled: true }),
    ).toBe("light-editorial");
  });
  it("falls back when light-editorial is requested but the flag is off", () => {
    expect(resolveTheme({ userPref: "light-editorial", lightEnabled: false })).toBe(
      "dark-cinematic",
    );
    expect(
      resolveTheme({
        cookie: "light-editorial",
        siteDefault: "light-editorial",
        lightEnabled: false,
      }),
    ).toBe("dark-cinematic");
  });
  it("ignores garbage values", () => {
    expect(
      resolveTheme({ userPref: "neon", cookie: "", siteDefault: null, lightEnabled: true }),
    ).toBe("dark-cinematic");
  });
  it("inline script is ≤ 300 bytes and gates light-editorial by flag", () => {
    for (const flag of [true, false]) {
      const s = inlineThemeScript(flag);
      expect(Buffer.byteLength(s, "utf8")).toBeLessThanOrEqual(300);
      expect(s).toContain("ck_theme");
      expect(s).toContain(flag ? "&&1" : "&&0");
    }
  });
});
