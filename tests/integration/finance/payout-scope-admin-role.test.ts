import { beforeAll, describe, expect, it } from "vitest";
import { financeService } from "@/modules/finance/service";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner } from "../../factories/users";
import { buildContext } from "@/lib/authz/context";

describe("payout and balance role scoping (API-FIN-03, API-FIN-11, D-1105)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("admin role is restricted to own partner balance; super_admin can read all", async () => {
    await truncateAll();

    const adminUser1 = await createAdmin();
    const adminUser2 = await createAdmin();
    const superAdminUser = await createAdmin({ role: "super_admin" });

    const partner1 = await createPartner({ userId: adminUser1.id });
    const partner2 = await createPartner({ userId: adminUser2.id });

    const admin1Ctx = buildContext({
      user: { id: adminUser1.id },
      session: { id: "sess-1" },
      roles: ["admin"],
    });

    const superAdminCtx = buildContext({
      user: { id: superAdminUser.id },
      session: { id: "sess-super" },
      roles: ["super_admin"],
    });

    // 1. Admin 1 can read own partner balance
    const ownBalances = await financeService.getPartnerBalances(admin1Ctx, {
      partnerId: partner1.id,
    });
    expect(ownBalances).toHaveLength(1);
    expect(ownBalances[0]?.partnerId).toBe(partner1.id);

    // 2. Admin 1 cannot read Partner 2 balance -> FORBIDDEN
    await expect(
      financeService.getPartnerBalances(admin1Ctx, {
        partnerId: partner2.id,
      }),
    ).rejects.toThrow(/Cannot read another partner's balance/i);

    // 3. Super admin can read Partner 2 balance
    const partner2Balances = await financeService.getPartnerBalances(superAdminCtx, {
      partnerId: partner2.id,
    });
    expect(partner2Balances).toHaveLength(1);
    expect(partner2Balances[0]?.partnerId).toBe(partner2.id);

    // 4. Admin 1 cannot list Partner 2 payouts -> FORBIDDEN
    await expect(
      financeService.listPayouts(admin1Ctx, {
        partnerId: partner2.id,
      }),
    ).rejects.toThrow(/Cannot read another partner's payouts/i);

    // 5. Super admin can list Partner 2 payouts
    const superAdminList = await financeService.listPayouts(superAdminCtx, {
      partnerId: partner2.id,
    });
    expect(superAdminList.items).toBeDefined();
  });
});
