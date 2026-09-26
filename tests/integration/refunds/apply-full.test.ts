/**
 * apply-full: full refund — ledger nets zero, order → refunded, payment → refunded.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db, withTx } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { approvalsService } from "@/modules/approvals/service";
import { buildContext } from "@/lib/authz/context";
import { orders, payments, refunds } from "../../../drizzle/schema/commerce";
import { users } from "../../../drizzle/schema/auth";
import { ledgerEntries } from "../../../drizzle/schema/finance";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOrder, createPayment, createInvoice } from "../../factories/commerce";

process.env.APP_ENV = "local";
process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "";
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;

beforeAll(async () => {
  await migrateTestDb();
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe("applyRefund — full refund AC", () => {
  it("full refund: ledger nets zero, payment confirmed→refunded once, order→refunded", async () => {
    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const partner = await createPartner({ userId: admin1.id });

    const product = await createProduct({
      isRefundable: true,
      createdBy: admin1.id,
      ownership: {
        companyCutBps: 3000,
        lines: [{ partnerId: partner.id, shareBps: 10_000 }],
      },
    });
    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 20_000, currency: "INR" },
    });
    const order = await createOrder({ offering, status: "paid" });
    const payment = await createPayment({ order, status: "confirmed", confirmedBy: admin1.id });

    // Issue invoice (required for credit note)
    await createInvoice({ order });

    // Post ledger entries first via financeService.postOrderPaid
    const { financeService } = await import("@/modules/finance/service");
    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    // Propose refund
    const proposeCtx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-1" },
      roles: ["admin"],
    });

    const { approvalRequestId } = await paymentsService.proposeRefund(proposeCtx, {
      orderId: order.id,
      paymentId: payment.id,
      amountMinor: 20_000,
      reason: "Full refund",
      revokeEntitlements: false,
      policyException: false,
    });

    const approveCtx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-2" },
      roles: ["admin"],
    });

    await approvalsService.approveRequest(approveCtx, {
      approvalRequestId,
      comment: null,
    });

    // Check payment → refunded
    const [updatedPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id));
    expect(updatedPayment?.status).toBe("refunded");
    expect(updatedPayment?.amountRefundedMinor).toBe(20_000);

    // Check order → refunded
    const [updatedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, order.id));
    expect(updatedOrder?.status).toBe("refunded");

    // Check ledger: all entries (sale + refund) net to zero per order
    const allEntries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, order.id));

    const total = allEntries.reduce((acc, e) => acc + e.amountMinor, 0);
    expect(total).toBe(0);

    // Verify refund row exists with executedAt and creditNoteId set
    const [refundRow] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, order.id));
    expect(refundRow?.executedAt).not.toBeNull();
    expect(refundRow?.creditNoteId).not.toBeNull();
  });
});
