import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { financeService } from "@/modules/finance/service";
import { allocations, ledgerEntries } from "../../../drizzle/schema/finance";
import { orderItems } from "../../../drizzle/schema/commerce";
import { productOwnerships } from "../../../drizzle/schema/ownership";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { createOrder, createPayment } from "../../factories/commerce";

describe("ownership at paid time (FI-10, BR-05, docs/06 §4.2)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("allocation uses the ownership version active at paid_at, not order creation", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partnerA = await createPartner({ userId: admin.id });
    const partnerB = await createPartner();
    const product = await createProduct({ createdBy: admin.id });

    // 1. Initial v1 active ownership (100% partner A, 0% company cut)
    const v1 = await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 0,
      createdBy: admin.id,
      lines: [{ partnerId: partnerA.id, shareBps: 10000 }],
      effectiveFrom: new Date("2026-09-01T00:00:00Z"),
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 10000, currency: "INR" },
    });
    const customer = await createUser();

    // 2. Order created when v1 was active
    const order = await createOrder({
      offering,
      user: customer,
      currency: "INR",
    });
    expect(order.items[0]?.ownershipId).toBe(v1.id);

    // 3. Ownership changes between order creation and payment confirmation:
    // v1 superseded, v2 becomes active with 50/50 split between A and B
    await db
      .update(productOwnerships)
      .set({ status: "superseded" })
      .where(eq(productOwnerships.id, v1.id));

    const v2 = await createOwnership({
      productId: product.id,
      version: 2,
      status: "active",
      companyCutBps: 0,
      createdBy: admin.id,
      lines: [
        { partnerId: partnerA.id, shareBps: 5000 },
        { partnerId: partnerB.id, shareBps: 5000 },
      ],
      effectiveFrom: new Date("2026-09-20T00:00:00Z"),
    });

    // 4. Payment confirmed when v2 is active
    await createPayment({
      order,
      status: "confirmed",
      amountReceivedMinor: 10000,
      confirmedBy: admin.id,
    });

    // 5. Post order paid
    const result = await withTx(async (tx) => {
      return await financeService.postOrderPaid(order.id, tx);
    });

    // 6. Assertions:
    // order_items.ownership_id updated to v2.id
    const [updatedItem] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, order.items[0]!.id));

    expect(updatedItem?.ownershipId).toBe(v2.id);

    // Allocation snapshot used v2 (50/50 split -> 5000 paise each)
    const [allocRow] = await db
      .select()
      .from(allocations)
      .where(eq(allocations.id, result.allocationIds[0]!));

    expect(allocRow?.ownershipId).toBe(v2.id);
    expect(allocRow?.lines).toEqual([
      { partner_id: partnerA.id, share_bps: 5000, amount_minor: 5000 },
      { partner_id: partnerB.id, share_bps: 5000, amount_minor: 5000 },
    ]);

    // Ledger entries contain lines for both partner A and partner B
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, order.id));

    const pEntries = entries.filter((e) => e.entryType === "partner_allocation");
    expect(pEntries).toHaveLength(2);
    expect(pEntries.find((e) => e.partnerId === partnerA.id)?.amountMinor).toBe(5000);
    expect(pEntries.find((e) => e.partnerId === partnerB.id)?.amountMinor).toBe(5000);
  });
});
