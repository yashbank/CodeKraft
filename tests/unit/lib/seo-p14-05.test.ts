import { describe, expect, it } from "vitest";

import { DEFAULT_ADMIN_ICON, DEFAULT_ICON } from "@/lib/brand-constants";
import { areaMetadata, brandIcons } from "@/lib/seo";

describe("P14-05 tab title + icons", () => {
  it("icons follow the uploaded logo, else the static fallback (icon + apple)", () => {
    expect(brandIcons("/u/logo.png")).toEqual({ icon: "/u/logo.png", apple: "/u/logo.png" });
    expect(brandIcons(null)).toEqual({ icon: DEFAULT_ICON, apple: DEFAULT_ICON });
    expect(brandIcons(null, DEFAULT_ADMIN_ICON).icon).toBe(DEFAULT_ADMIN_ICON);
  });

  it("area title is '<area> · <site name>' with a '<page> · <area> · <site name>' template", () => {
    const m = areaMetadata("Admin", "Acme", null, DEFAULT_ADMIN_ICON);
    expect(m.title).toEqual({
      absolute: "Admin · Acme",
      template: "%s · Admin · Acme",
    });
    expect(m.icons).toEqual({ icon: DEFAULT_ADMIN_ICON, apple: DEFAULT_ADMIN_ICON });
    expect(areaMetadata("Account", "Acme", "/l.png").icons).toEqual({
      icon: "/l.png",
      apple: "/l.png",
    });
  });
});
