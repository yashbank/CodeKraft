import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { settingsService } from "@/modules/settings/service";
import { createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("settings siteName + sellerDetails (BUG-088)", () => {
  const sql = getTestDb();
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("defaults to CodeKraft, persists edits and seller details", async () => {
    await truncateAll(sql);
    const admin = await createUser({ role: "super_admin" });
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "s" },
      roles: ["super_admin"],
    });
    expect((await settingsService.load()).siteName).toBe("CodeKraft");

    await settingsService.updateSettings(ctx, {
      patch: {
        siteName: "Acme Studio",
        sellerDetails: {
          name: "Acme Pvt Ltd",
          address: { line1: "1 Main St", city: "Pune", postalCode: "411001", country: "IN" },
          contactPhones: [],
          email: "billing@acme.test",
        },
      },
    });
    const after = await settingsService.load();
    expect(after.siteName).toBe("Acme Studio");
    expect(after.sellerDetails?.name).toBe("Acme Pvt Ltd");
  });

  it("rejects invalid seller email", async () => {
    await truncateAll(sql);
    const admin = await createUser({ role: "super_admin" });
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "s" },
      roles: ["super_admin"],
    });
    await expect(
      settingsService.updateSettings(ctx, {
        patch: {
          sellerDetails: {
            name: "A",
            address: { line1: "x", city: "y", postalCode: "1", country: "IN" },
            contactPhones: [],
            email: "nope",
          },
        },
      }),
    ).rejects.toThrow();
  });
});
