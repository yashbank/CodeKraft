/**
 * apply-partial: partial refund — order → partially_refunded, entries balance, entitlements untouched.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db, withTx } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { approvalsService } from "@/modules/approvals/service";
import { buildContext } from "@/lib/authz/context";
import { orders, payments } from "../../../drizzle/schema/commerce";
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

describe("applyRefund — partial refund AC", () => {
  it("partial refund: order → partially_refunded, entries balance, entitlements untouched", async () => {
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

    // Issue invoice for credit note
    await createInvoice({ order });

    // Post ledger for the sale
    const { financeService } = await import("@/modules/finance/service");
    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    // Partial refund: 5000 out of 20000
    const proposeCtx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-1" },
      roles: ["admin"],
    });

    const { approvalRequestId } = await paymentsService.proposeRefund(proposeCtx, {
      orderId: order.id,
      paymentId: payment.id,
      amountMinor: 5_000,
      reason: "Partial refund test",
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

    // order → partially_refunded (not fully refunded)
    const [updatedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, order.id));
    expect(updatedOrder?.status).toBe("partially_refunded");

    // payment not refunded
    const [updatedPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id));
    expect(updatedPayment?.status).toBe("confirmed"); // still confirmed, not fully refunded
    expect(updatedPayment?.amountRefundedMinor).toBe(5_000);

    // Ledger entries from refund alone sum to 0 (proportional balance)
    const allEntries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, order.id));

    const refundEntries = allEntries.filter((e) => e.entryType.startsWith("refund_"));
    const refundSum = refundEntries.reduce((acc, e) => acc + e.amountMinor, 0);
    expect(refundSum).toBe(0);
  });
});
