import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { ordersService } from "@/modules/orders/service";
import { approvalsService } from "@/modules/approvals/service";
import { paymentsService } from "@/modules/payments/service";
import { invoicesService } from "@/modules/invoices/service";
import { orders, orderItems } from "../../../../drizzle/schema/commerce";
import { invoices } from "../../../../drizzle/schema/invoices";
import { allocations } from "../../../../drizzle/schema/finance";
import { migrateTestDb } from "../../../setup/migrate";
import { truncateAll } from "../../../setup/db";
import { createAdmin, createPartner } from "../../../factories/users";
import { buildContext } from "@/lib/authz/context";

describe("Project order blocked until approved (BR-05, S-12)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("blocks payment and invoice until split is approved, then completes S-12 50/50 allocation", async () => {
    await truncateAll();

    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const partner1 = await createPartner({ userId: admin1.id });
    const partner2 = await createPartner({ userId: admin2.id });

    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["admin"],
    });

    const admin2Ctx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-admin-2" },
      roles: ["admin"],
    });

    // 1. Create project order with two free-form lines, 50/50 split
    const res = await ordersService.createManualOrder(admin1Ctx, {
      type: "project",
      customer: {
        clientName: "Global Client Ltd",
        clientEmail: "finance@globalclient.com",
        clientCompany: "Global Client",
      },
      currency: "INR",
      items: [
        {
          description: "Frontend Implementation",
          unitMinor: 50000,
          quantity: 1,
          splitSnapshot: {
            companyCutBps: 1000,
            lines: [
              { partnerId: partner1.id, shareBps: 5000 },
              { partnerId: partner2.id, shareBps: 5000 },
            ],
          },
        },
        {
          description: "Backend API Integration",
          unitMinor: 50000,
          quantity: 1,
          splitSnapshot: {
            companyCutBps: 1000,
            lines: [
              { partnerId: partner1.id, shareBps: 5000 },
              { partnerId: partner2.id, shareBps: 5000 },
            ],
          },
        },
      ],
      taxEnabled: false,
      billing: {
        name: "Global Client Ltd",
        email: "finance@globalclient.com",
        country: "IN",
      },
    });

    expect(res.orderId).toBeDefined();
    expect(res.approvalRequestId).toBeDefined();

    // Create payment intent
    const intent = await withTx(async (tx) => {
      return await paymentsService.createIntentForOrder(
        res.orderId,
        "manual_bank",
        tx,
      );
    });

    // 2. Before approval: payment confirmation throws STATE_INVALID
    await expect(
      paymentsService.confirmPayment(admin2Ctx, {
        paymentId: intent.paymentId,
        amountReceivedMinor: 100000,
        reference: "UTR-BLOCKED-1",
        receivedOn: "2026-09-26",
      }),
    ).rejects.toThrow(/Project order requires split approval before confirmation/);

    // 3. Before approval: invoice issue throws STATE_INVALID
    await expect(
      withTx(async (tx) => {
        return await invoicesService.issueInvoice(
          { orderId: res.orderId },
          { userId: admin1.id },
          tx,
        );
      }),
    ).rejects.toThrow(/Project order requires split approval/);

    // 4. Admin 2 approves split
    const decideRes = await withTx(async (tx) => {
      return await approvalsService.decide(
        res.approvalRequestId!,
        admin2.id,
        "approve",
        "Dual admin sign-off",
        tx,
      );
    });
    expect(decideRes.status).toBe("applied");

    // 5. After approval: payment confirmation succeeds
    const confirmRes = await paymentsService.confirmPayment(admin2Ctx, {
      paymentId: intent.paymentId,
      amountReceivedMinor: 100000,
      reference: "UTR-UNBLOCKED-1",
      receivedOn: "2026-09-26",
    });

    expect(confirmRes.order.status).toBe("paid");
    expect(confirmRes.invoiceId).toBeDefined();
    expect(confirmRes.invoiceNo).toMatch(/^CK\/\d{4}-\d{2}\/\d{4}$/);

    // 6. Verify allocations to both partners for both lines
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, res.orderId));
    expect(items.length).toBe(2);

    for (const item of items) {
      const [alloc] = await db
        .select()
        .from(allocations)
        .where(eq(allocations.orderItemId, item.id));
      expect(alloc).toBeDefined();
      expect(alloc?.companyCutBps).toBe(1000);
      // Both partners are present in lines snapshot
      const p1Line = alloc?.lines.find((l) => l.partner_id === partner1.id);
      const p2Line = alloc?.lines.find((l) => l.partner_id === partner2.id);
      expect(p1Line?.share_bps).toBe(5000);
      expect(p2Line?.share_bps).toBe(5000);
    }

    // 7. Verify invoice in DB
    const [inv] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, confirmRes.invoiceId!));
    expect(inv?.orderId).toBe(res.orderId);
    expect(inv?.totalMinor).toBe(100000);
  });
});
