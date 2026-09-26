import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { financeService } from "@/modules/finance/service";
import { allocations, ledgerEntries } from "../../../drizzle/schema/finance";
import { orderItems, orders } from "../../../drizzle/schema/commerce";
import { approvalRequests } from "../../../drizzle/schema/approvals";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createOrder, createPayment } from "../../factories/commerce";

describe("project split snapshot (docs/06 §4.2, MASTER_SPEC §7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("refuses posting when project order lacks an applied split approval", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partner = await createPartner({ userId: admin.id });
    const customer = await createUser();

    const order = await createOrder({
      user: customer,
      currency: "INR",
      withItem: false,
    });

    // Insert project line without approval request on the order
    await db.insert(orderItems).values({
      orderId: order.id,
      productId: null,
      offeringId: null,
      description: "Custom Web Development Project",
      quantity: 1,
      unitMinor: 100000,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 100000,
      ownershipId: null,
      splitSnapshot: {
        company_cut_bps: 2000,
        lines: [{ partner_id: partner.id, share_bps: 10000 }],
      },
    });

    await createPayment({
      order: { id: order.id, totalMinor: 100000, currency: "INR" },
      status: "confirmed",
      amountReceivedMinor: 100000,
      confirmedBy: admin.id,
    });

    await expect(
      withTx(async (tx) => {
        return await financeService.postOrderPaid(order.id, tx);
      }),
    ).rejects.toThrow(/Project order items require split approval request ID/);
  });

  it("refuses posting when project split approval request is pending (not applied)", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partner = await createPartner({ userId: admin.id });
    const customer = await createUser();

    // Create approval request with status 'pending'
    const [approval] = await db
      .insert(approvalRequests)
      .values({
        type: "project_order.split",
        subjectType: "order",
        subjectId: "00000000-0000-4000-8000-000000000001",
        requestedBy: admin.id,
        status: "pending",
        payload: {},
      })
      .returning();

    const order = await createOrder({
      user: customer,
      currency: "INR",
      withItem: false,
    });

    await db.update(orders).set({ splitApprovalRequestId: approval!.id }).where(eq(orders.id, order.id));

    await db.insert(orderItems).values({
      orderId: order.id,
      productId: null,
      offeringId: null,
      description: "Project Item",
      quantity: 1,
      unitMinor: 50000,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 50000,
      ownershipId: null,
      splitSnapshot: {
        company_cut_bps: 1000,
        lines: [{ partner_id: partner.id, share_bps: 10000 }],
      },
    });

    await createPayment({
      order: { id: order.id, totalMinor: 50000, currency: "INR" },
      status: "confirmed",
      amountReceivedMinor: 50000,
      confirmedBy: admin.id,
    });

    await expect(
      withTx(async (tx) => {
        return await financeService.postOrderPaid(order.id, tx);
      }),
    ).rejects.toThrow(/Project order split approval must be applied/);
  });

  it("posts project line successfully when split approval is applied", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partnerA = await createPartner({ userId: admin.id });
    const partnerB = await createPartner();
    const customer = await createUser();

    const [approval] = await db
      .insert(approvalRequests)
      .values({
        type: "project_order.split",
        subjectType: "order",
        subjectId: "00000000-0000-4000-8000-000000000001",
        requestedBy: admin.id,
        status: "applied",
        appliedAt: new Date(),
        payload: {},
      })
      .returning();

    const order = await createOrder({
      user: customer,
      currency: "INR",
      withItem: false,
    });

    await db.update(orders).set({ splitApprovalRequestId: approval!.id }).where(eq(orders.id, order.id));

    // Custom project order item with 10% company cut, 70/30 split between A and B
    await db.insert(orderItems).values({
      orderId: order.id,
      productId: null,
      offeringId: null,
      description: "Enterprise Custom Portal",
      quantity: 1,
      unitMinor: 200000,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 200000,
      ownershipId: null,
      splitSnapshot: {
        company_cut_bps: 1000,
        lines: [
          { partner_id: partnerA.id, share_bps: 7000 },
          { partner_id: partnerB.id, share_bps: 3000 },
        ],
      },
    });

    await createPayment({
      order: { id: order.id, totalMinor: 200000, currency: "INR" },
      status: "confirmed",
      amountReceivedMinor: 200000,
      confirmedBy: admin.id,
    });

    const result = await withTx(async (tx) => {
      return await financeService.postOrderPaid(order.id, tx);
    });

    expect(result.allocationIds).toHaveLength(1);

    // Assert allocations row
    const [allocRow] = await db
      .select()
      .from(allocations)
      .where(eq(allocations.id, result.allocationIds[0]!));

    expect(allocRow?.ownershipId).toBeNull();
    // 200,000 gross -> distributable = 200,000
    // company cut (10%) = 20,000
    // pool = 180,000 -> partner A (70%) = 126,000; partner B (30%) = 54,000
    expect(allocRow?.distributableMinor).toBe(200000);
    expect(allocRow?.companyMinor).toBe(20000);
    expect(allocRow?.lines).toEqual([
      { partner_id: partnerA.id, share_bps: 7000, amount_minor: 126000 },
      { partner_id: partnerB.id, share_bps: 3000, amount_minor: 54000 },
    ]);

    // Assert ledger entries
    const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.orderId, order.id));
    const partnerAEntry = entries.find((e) => e.partnerId === partnerA.id)!;
    const partnerBEntry = entries.find((e) => e.partnerId === partnerB.id)!;
    expect(partnerAEntry.amountMinor).toBe(126000);
    expect(partnerBEntry.amountMinor).toBe(54000);

    const sum = entries.reduce((acc, e) => acc + e.amountMinor, 0);
    expect(sum).toBe(0);
  });
});
