import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { clearFlagCache, getAllFlags, getFlag } from "@/lib/feature-flags";
import { settingsService } from "@/modules/settings/service";
import { createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("feature flags precedence (env > DB > default, docs/13 §6, PHASE-03 P3.3)", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  afterEach(() => {
    delete process.env.FEATURE_PHONE_OTP;
    delete process.env.FEATURE_THEME_LIGHT_EDITORIAL;
    clearFlagCache();
  });

  it("reads flag from DB when env variable is not set", async () => {
    await truncateAll(sql);
    clearFlagCache();

    const admin = await createUser({ role: "super_admin" });
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    // Default for phone_otp is false
    expect(await getFlag("phone_otp")).toBe(false);

    // Update DB flag
    await settingsService.updateSettings(ctx, {
      patch: {
        flags: {
          phone_otp: true,
        },
      },
    });

    // DB value takes effect
    expect(await getFlag("phone_otp")).toBe(true);
  });

  it("env variable overrides DB value (env > DB)", async () => {
    await truncateAll(sql);
    clearFlagCache();

    const admin = await createUser({ role: "super_admin" });
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    // Enable in DB
    await settingsService.updateSettings(ctx, {
      patch: {
        flags: {
          phone_otp: true,
        },
      },
    });

    expect(await getFlag("phone_otp")).toBe(true);

    // Set env to false -> env must win
    process.env.FEATURE_PHONE_OTP = "false";
    clearFlagCache();
    expect(await getFlag("phone_otp")).toBe(false);

    // Set env to true -> env must win
    process.env.FEATURE_PHONE_OTP = "true";
    clearFlagCache();
    expect(await getFlag("phone_otp")).toBe(true);
  });

  it("getAllFlags resolves all flags defined in docs/13 §6", async () => {
    const all = await getAllFlags();
    expect(all).toHaveProperty("phone_otp");
    expect(all).toHaveProperty("whatsapp_channel");
    expect(all).toHaveProperty("theme_light_editorial");
    expect(all).toHaveProperty("provider_razorpay");
    expect(all).toHaveProperty("provider_stripe");
    expect(all).toHaveProperty("provider_paypal");
    expect(all).toHaveProperty("automated_provisioning");
    expect(all).toHaveProperty("three_hero");
    expect(all).toHaveProperty("bundles");
    expect(all).toHaveProperty("vendor_marketplace");
  });
});
