import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { orderItems, orders, payments } from "../../../drizzle/schema/commerce";
import { approvalRequests } from "../../../drizzle/schema/approvals";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { buildContext } from "@/lib/authz/context";

describe("confirmPayment project order split approval check (BR-05, MASTER_SPEC §7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("refuses to confirm project order if splitApprovalRequestId is missing or not applied", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });
    const partner = await createPartner({ userId: admin.id });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    // Create a project order without an applied approval
    const [projectOrder] = await db
      .insert(orders)
      .values({
        orderNo: "CK-ORD-999001",
        type: "project",
        userId: customer.id,
        status: "pending_payment",
        currency: "INR",
        subtotalMinor: 50000,
        totalMinor: 50000,
        billingSnapshot: {
          name: "Project Client",
          email: "client@example.com",
          country: "IN",
        },
        fxRateToInr: "1.0",
      })
      .returning();

    await db.insert(orderItems).values({
      orderId: projectOrder!.id,
      description: "Custom project work",
      quantity: 1,
      unitMinor: 50000,
      totalMinor: 50000,
      splitSnapshot: {
        company_cut_bps: 1000,
        lines: [{ partner_id: partner.id, share_bps: 10000 }],
      },
    });

    const [pmt] = await db
      .insert(payments)
      .values({
        orderId: projectOrder!.id,
        provider: "manual_bank",
        status: "initiated",
        amountDueMinor: 50000,
        currency: "INR",
      })
      .returning();

    // 1. Missing approval request
    await expect(
      paymentsService.confirmPayment(adminCtx, {
        paymentId: pmt!.id,
        amountReceivedMinor: 50000,
        reference: "UTR-PROJ-1",
        receivedOn: "2026-09-26",
      }),
    ).rejects.toThrow("Project order requires split approval before confirmation");

    // 2. Pending approval request
    const [approval] = await db
      .insert(approvalRequests)
      .values({
        type: "project_order.split",
        status: "pending",
        subjectType: "order",
        subjectId: projectOrder!.id,
        requestedBy: admin.id,
        payload: { orderId: projectOrder!.id },
      })
      .returning();

    await db
      .update(orders)
      .set({ splitApprovalRequestId: approval!.id })
      .where(eq(orders.id, projectOrder!.id));

    await expect(
      paymentsService.confirmPayment(adminCtx, {
        paymentId: pmt!.id,
        amountReceivedMinor: 50000,
        reference: "UTR-PROJ-1",
        receivedOn: "2026-09-26",
      }),
    ).rejects.toThrow("Project order split approval must be applied");

    // 3. Mark approval applied -> confirmation succeeds
    await db
      .update(approvalRequests)
      .set({ status: "applied" })
      .where(eq(approvalRequests.id, approval!.id));

    const confirmRes = await paymentsService.confirmPayment(adminCtx, {
      paymentId: pmt!.id,
      amountReceivedMinor: 50000,
      reference: "UTR-PROJ-1",
      receivedOn: "2026-09-26",
    });

    expect(confirmRes.payment.status).toBe("confirmed");
    expect(confirmRes.order.status).toBe("paid");
  });
});
