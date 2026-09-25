import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { settingsService } from "@/modules/settings/service";
import { createOrder } from "../../factories/commerce";
import { createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("settings base-currency lock (FR-ADM-10, MASTER_SPEC §7, PHASE-03 P3.3)", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("allows base currency changes when no orders exist", async () => {
    await truncateAll(sql);
    const admin = await createUser({ role: "super_admin" });
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    const result = await settingsService.updateSettings(ctx, {
      patch: {
        baseCurrency: "USD",
        enabledCurrencies: ["USD", "EUR", "INR"],
      },
    });

    expect(result.settings.baseCurrency).toBe("USD");
  });

  it("still allows base currency changes when only pending_payment orders exist", async () => {
    await truncateAll(sql);
    const admin = await createUser({ role: "super_admin" });
    const customer = await createUser({ role: "customer" });
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    // Create a pending_payment order
    await createOrder({
      user: customer,
      status: "pending_payment",
    });

    const result = await settingsService.updateSettings(ctx, {
      patch: {
        baseCurrency: "EUR",
        enabledCurrencies: ["EUR", "USD", "INR"],
      },
    });

    expect(result.settings.baseCurrency).toBe("EUR");
  });

  it("refuses base currency changes with STATE_INVALID once a paid order exists", async () => {
    await truncateAll(sql);
    const admin = await createUser({ role: "super_admin" });
    const customer = await createUser({ role: "customer" });
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    // Create a paid order
    await createOrder({
      user: customer,
      status: "paid",
    });

    // Attempting to change base currency must be refused
    await expect(
      settingsService.updateSettings(ctx, {
        patch: {
          baseCurrency: "USD",
          enabledCurrencies: ["USD", "INR"],
        },
      }),
    ).rejects.toThrow(/Base currency cannot be changed/i);

    // Other non-currency settings can still be updated freely
    const nonCurrencyUpdate = await settingsService.updateSettings(ctx, {
      patch: {
        defaultTheme: "dark-cinematic",
        taxRateBps: 1200,
      },
    });
    expect(nonCurrencyUpdate.settings.taxRateBps).toBe(1200);
  });
});
