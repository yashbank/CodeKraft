import { describe, expect, it } from "vitest";

import { buildManifest } from "@/lib/pwa";
import { THEME_COLOR } from "@/lib/theme";

describe("buildManifest (P14-12b)", () => {
  it("uses the site name, theme colours and 192/512 icons", () => {
    const m = buildManifest({ siteName: "Acme Studio", theme: "light-editorial" });
    expect(m.name).toBe("Acme Studio");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.theme_color).toBe(THEME_COLOR["light-editorial"]);
    expect(m.background_color).toBe(THEME_COLOR["light-editorial"]);
    const sizes = m.icons?.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("adds the uploaded logo as the first icon and shortens a long short_name", () => {
    const m = buildManifest({
      siteName: "A Very Long Studio Name",
      logo: "/api/files/logo.png",
      theme: "dark-cinematic",
    });
    expect(m.icons?.[0]?.src).toBe("/api/files/logo.png");
    expect(m.short_name!.length).toBeLessThanOrEqual(12);
  });
});
