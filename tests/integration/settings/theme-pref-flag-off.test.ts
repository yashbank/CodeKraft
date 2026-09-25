import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { anonymousContext, buildContext } from "@/lib/authz/context";
import { clearFlagCache } from "@/lib/feature-flags";
import { settingsService } from "@/modules/settings/service";
import { updateAccountSettingsAction } from "@/modules/users/settings-actions";
import { createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("theme preference with light-editorial flag off (D-1602, API-AUTH-04/10, PHASE-03 P3.3)", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  afterEach(() => {
    delete process.env.FEATURE_THEME_LIGHT_EDITORIAL;
    clearFlagCache();
  });

  it("refuses light-editorial in setVisitorPreferences when theme_light_editorial flag is off", async () => {
    clearFlagCache();
    process.env.FEATURE_THEME_LIGHT_EDITORIAL = "false";

    const anonymousCtx = anonymousContext();

    await expect(
      settingsService.setVisitorPreferences(anonymousCtx, {
        theme: "light-editorial",
      }),
    ).rejects.toThrow(/disabled/i);
  });

  it("refuses light-editorial in updateAccountSettingsAction when theme_light_editorial flag is off", async () => {
    await truncateAll(sql);
    clearFlagCache();
    process.env.FEATURE_THEME_LIGHT_EDITORIAL = "false";

    const user = await createUser({ role: "customer" });
    const userCtx = buildContext({
      user: { id: user.id },
      session: { id: "sess-user" },
      roles: ["customer"],
    });

    const res = await updateAccountSettingsAction({ themePref: "light-editorial" }, userCtx);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("FORBIDDEN");
    }
  });

  it("allows light-editorial when flag is enabled", async () => {
    await truncateAll(sql);
    clearFlagCache();
    process.env.FEATURE_THEME_LIGHT_EDITORIAL = "true";

    const user = await createUser({ role: "customer" });
    const userCtx = buildContext({
      user: { id: user.id },
      session: { id: "sess-user" },
      roles: ["customer"],
    });

    // 1. Visitor preferences
    const visitorRes = await settingsService.setVisitorPreferences(userCtx, {
      theme: "light-editorial",
      displayCurrency: "USD",
    });
    expect(visitorRes.ok).toBe(true);
    expect(visitorRes.cookies.ck_theme).toBe("light-editorial");
    expect(visitorRes.cookies.ck_currency).toBe("USD");

    // 2. Account settings
    const accountRes = await updateAccountSettingsAction({ themePref: "light-editorial" }, userCtx);
    expect(accountRes.ok).toBe(true);
    if (accountRes.ok) {
      expect(accountRes.data.settings.themePref).toBe("light-editorial");
    }
  });
});
