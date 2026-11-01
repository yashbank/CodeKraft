import { describe, expect, it, vi } from "vitest";
import { anonymousContext, buildContext } from "@/lib/authz/context";

vi.mock("@/modules/settings/service", () => ({
  settingsService: {
    updateSettings: vi.fn(),
    load: async () => ({
      defaultTheme: "light-editorial",
      themeToggle: true,
      palette: "ember",
      uiFont: "serif",
      uiRadius: "lg",
      uiBorder: "thin",
      uiPattern: "grid",
      uiLayout: "wide",
      uiDensity: "compact",
      themeStudio: {},
    }),
  },
}));

describe("C16-04 admin-chosen design", () => {
  it("settings action rejects users without settings.write", async () => {
    const { updateSettingsAction } = await import("@/modules/settings/actions");
    const { settingsService } = await import("@/modules/settings/service");
    const customer = buildContext({
      user: { id: "u1" },
      session: { id: "s" },
      roles: ["customer"],
      requestId: "r",
    });
    expect(await updateSettingsAction({ patch: { palette: "ember" } }, customer)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(
      await updateSettingsAction(
        { patch: { palette: "ember" } },
        anonymousContext({ requestId: "r" }),
      ),
    ).toMatchObject({ ok: false });
    expect(settingsService.updateSettings).not.toHaveBeenCalled();
  });

  it("anonymous render resolves the design from stored settings", async () => {
    const { getThemeConfig } = await import("@/lib/site-brand");
    const c = await getThemeConfig();
    expect(c).toMatchObject({ defaultTheme: "light-editorial", palette: "ember" });
    expect(c.ui).toMatchObject({ font: "serif", radius: "lg", layout: "wide" });
  });
});
