import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { usersService } from "@/modules/users/service";
import { partners } from "../../../drizzle/schema/users-ext";
import { createPartner, createSuperAdmin } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("partner bank details encryption (API-ADM-12, SA-14 analogue, PHASE-03 P3.4)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("encrypts partner bank details at rest and masks account number in API output", async () => {
    await truncateAll();
    const db = (await import("@/lib/db")).db;

    const admin = await createSuperAdmin();
    const partner = await createPartner({ displayName: "Creative Labs" });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    const bankDetails = {
      accountName: "Creative Labs LLC",
      accountNumber: "987654321098",
      ifsc: "HDFC0000123",
      bankName: "HDFC Bank",
    };

    const updateRes = await usersService.updatePartner(adminCtx, {
      partnerId: partner.id,
      payoutBankDetails: bankDetails,
    });

    // 1. Output from update contains masked last-4 digits
    expect(updateRes.partner.hasPayoutDetails).toBe(true);
    expect(updateRes.partner.payoutAccountLast4).toBe("1098");

    // 2. Direct DB inspection asserts encryption envelope (v1:...)
    const [rawRow] = await db.select().from(partners).where(eq(partners.id, partner.id));
    expect(rawRow!.payoutBankDetailsEnc).toBeDefined();
    expect(rawRow!.payoutBankDetailsEnc?.startsWith("v1:")).toBe(true);

    // 3. Raw account number is NOT present in cleartext in the database
    expect(rawRow!.payoutBankDetailsEnc?.includes("987654321098")).toBe(false);

    // 4. listPartners returns masked view
    const listRes = await usersService.listPartners(adminCtx, {
      limit: 10,
    });

    const partnerItem = listRes.items.find((p) => p.id === partner.id);
    expect(partnerItem).toBeDefined();
    expect(partnerItem!.hasPayoutDetails).toBe(true);
    expect(partnerItem!.payoutAccountLast4).toBe("1098");
  });
});
