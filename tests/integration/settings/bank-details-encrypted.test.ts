import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { isEncryptedToken } from "@/lib/crypto";
import { settingsService } from "@/modules/settings/service";
import { SITE_SETTING_KEYS } from "@/modules/settings/types";
import { createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("settings bank details encryption & masking (SA-14 analogue, API-ADM-10, PHASE-03 P3.3)", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("stores bank details encrypted in site_settings table and masks for read-only admin", async () => {
    await truncateAll(sql);

    const superAdmin = await createUser({ role: "super_admin" });
    const superAdminCtx = buildContext({
      user: { id: superAdmin.id },
      session: { id: "sess-super" },
      roles: ["super_admin"],
    });

    const readOnlyAdmin = await createUser({ role: "admin" });
    const readOnlyAdminCtx = buildContext({
      user: { id: readOnlyAdmin.id },
      session: { id: "sess-read" },
      roles: ["admin"], // role admin has settings.read but not settings.write
    });

    const plainBank = {
      accountName: "CodeKraft Tech Pvt Ltd",
      accountNumber: "987654321098",
      ifsc: "HDFC0001234",
      bankName: "HDFC Bank",
      branch: "Koregaon Park",
    };

    // 1. Super admin updates bank details
    await settingsService.updateSettings(superAdminCtx, {
      patch: {
        bankDetails: plainBank,
      },
    });

    // 2. Direct database inspection: value must NOT contain raw account number, but an encrypted token
    const [row] = await sql<{ key: string; value: unknown }[]>`
      select key, value from site_settings where key = ${SITE_SETTING_KEYS.bankDetails} limit 1
    `;

    expect(row).toBeDefined();
    const encryptedVal = row?.value as string;
    expect(typeof encryptedVal).toBe("string");
    expect(isEncryptedToken(encryptedVal)).toBe(true);
    expect(JSON.stringify(encryptedVal)).not.toContain("987654321098");

    // 3. Super admin (settings.write) reads settings -> unmasked
    const superAdminRead = await settingsService.getSettings(superAdminCtx);
    expect(superAdminRead.settings.bankDetails?.accountNumber).toBe("987654321098");

    // 4. Read-only admin (settings.read only) reads settings -> masked
    const readOnlyRead = await settingsService.getSettings(readOnlyAdminCtx);
    expect(readOnlyRead.settings.bankDetails?.accountNumber).toBe("********1098");
  });
});
