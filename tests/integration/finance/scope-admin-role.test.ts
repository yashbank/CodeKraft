import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { financeService } from "@/modules/finance/service";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createOrder, createPayment } from "../../factories/commerce";

describe("finance scoping by admin role (docs/06 API-FIN-01, API-FIN-02)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("admin cannot read another partner's ledger lines and sees only own partner lines", async () => {
    await truncateAll();

    const adminA = await createAdmin();
    const adminB = await createAdmin();

    const partnerA = await createPartner({ userId: adminA.id, displayName: "Partner A" });
    const partnerB = await createPartner({ userId: adminB.id, displayName: "Partner B" });

    const product = await createProduct({ createdBy: adminA.id });

    // Active ownership: 60% partner A, 40% partner B
    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 0,
      createdBy: adminA.id,
      lines: [
        { partnerId: partnerA.id, shareBps: 6000 },
        { partnerId: partnerB.id, shareBps: 4000 },
      ],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 10000, currency: "INR" },
    });
    const customer = await createUser();

    const order = await createOrder({
      offering,
      user: customer,
      currency: "INR",
    });

    await createPayment({
      order,
      status: "confirmed",
      amountReceivedMinor: 10000,
      confirmedBy: adminA.id,
    });

    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    // Admin B context (regular admin, has finance.ledger.read scoped to own lines, no read_all)
    const ctxAdminB = buildContext({
      user: { id: adminB.id },
      session: { id: "sess-b" },
      roles: ["admin"],
      partnerId: partnerB.id,
    });

    // Super admin context (has finance.ledger.read_all)
    const ctxSuperAdmin = buildContext({
      user: { id: adminA.id },
      session: { id: "sess-super" },
      roles: ["super_admin"],
    });

    // 1. Admin B reading listLedgerEntries with partnerId = partnerA -> FORBIDDEN
    await expect(
      financeService.listLedgerEntries(ctxAdminB, {
        limit: 50,
        filters: { partnerId: partnerA.id },
      }),
    ).rejects.toThrow(/Cannot read another partner's ledger lines/);

    // 2. Admin B reading listLedgerEntries without partner filter:
    // Should see their own partner line (4000 minor) and NOT partner A's line
    const listResB = await financeService.listLedgerEntries(ctxAdminB, { limit: 50 });
    const partnerEntriesB = listResB.items.filter((e) => e.entryType === "partner_allocation");
    expect(partnerEntriesB).toHaveLength(1);
    expect(partnerEntriesB[0]?.partnerId).toBe(partnerB.id);
    expect(partnerEntriesB[0]?.amount.amountMinor).toBe(4000);

    // 3. Super admin sees all partner lines (both partner A and partner B)
    const listResSuper = await financeService.listLedgerEntries(ctxSuperAdmin, { limit: 50 });
    const partnerEntriesSuper = listResSuper.items.filter((e) => e.entryType === "partner_allocation");
    expect(partnerEntriesSuper).toHaveLength(2);

    // 4. Admin B calling getOrderAllocation sees only their own line in lines[]
    const allocViewB = await financeService.getOrderAllocation(ctxAdminB, { orderId: order.id });
    expect(allocViewB.items[0]?.lines).toHaveLength(1);
    expect(allocViewB.items[0]?.lines[0]?.partnerId).toBe(partnerB.id);

    // 5. Super admin sees all lines in getOrderAllocation
    const allocViewSuper = await financeService.getOrderAllocation(ctxSuperAdmin, { orderId: order.id });
    expect(allocViewSuper.items[0]?.lines).toHaveLength(2);
  });
});
