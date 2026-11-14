import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The admin top bar badge comes from the site phase setting, never from APP_ENV. */
const FILES = [
  "src/components/admin/AdminShell.tsx",
  "src/components/admin/AdminShellWrapper.tsx",
  "src/app/(admin)/admin/layout.tsx",
  "src/app/(admin)/admin/settings/page.tsx",
  "src/components/admin/system/SettingsScreen.tsx",
];

describe("admin shell does not derive a badge from APP_ENV", () => {
  for (const f of FILES) {
    it(f, () => {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/APP_ENV/);
      expect(src).not.toMatch(/\benvironment[=:?]/);
    });
  }
  it("AdminShell badge is gated by phaseBadge()", () => {
    expect(readFileSync(FILES[0]!, "utf8")).toContain("phaseBadge(user.role, sitePhase)");
  });
});
