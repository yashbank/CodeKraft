/**
 * payment-transition-once: payment transitions to 'refunded' only once on full refund.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, withTx } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { approvalsService } from "@/modules/approvals/service";
import { buildContext } from "@/lib/authz/context";
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

describe("applyRefund — payment state machine", () => {
  it("second full refund on already-refunded payment is refused at proposeRefund (amount exceeds refundable balance)", async () => {
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
      price: { amountMinor: 10_000, currency: "INR" },
    });
    const order = await createOrder({ offering, status: "paid" });
    const payment = await createPayment({ order, status: "confirmed", confirmedBy: admin1.id });

    await createInvoice({ order });

    const { financeService } = await import("@/modules/finance/service");
    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    const ctx1 = buildContext({ user: { id: admin1.id }, session: { id: "s1" }, roles: ["admin"] });
    const ctx2 = buildContext({ user: { id: admin2.id }, session: { id: "s2" }, roles: ["admin"] });

    // First full refund succeeds
    const { approvalRequestId } = await paymentsService.proposeRefund(ctx1, {
      orderId: order.id,
      paymentId: payment.id,
      amountMinor: 10_000,
      reason: "First",
      revokeEntitlements: false,
      policyException: false,
    });
    await approvalsService.approveRequest(ctx2, { approvalRequestId, comment: null });

    // Second full refund attempt must be refused (already refunded in full)
    await expect(
      paymentsService.proposeRefund(ctx1, {
        orderId: order.id,
        paymentId: payment.id,
        amountMinor: 10_000,
        reason: "Second attempt",
        revokeEntitlements: false,
        policyException: false,
      }),
    ).rejects.toThrow(/refundable balance|exceeded|partially_refunded/i);
  });
});
