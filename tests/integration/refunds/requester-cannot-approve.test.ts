/**
 * requester-cannot-approve: BR-13 — the admin who proposes a refund cannot self-approve. (@security SA-09)
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

describe("proposeRefund — BR-13 requester cannot self-approve", () => {
  it("rejects when requester tries to approve their own refund.issue", async () => {
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

    // admin2 proposes the refund
    const proposeCtx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-requester" },
      roles: ["admin"],
    });

    const { approvalRequestId } = await paymentsService.proposeRefund(proposeCtx, {
      orderId: order.id,
      paymentId: payment.id,
      amountMinor: 10_000,
      reason: "Test",
      revokeEntitlements: false,
      policyException: false,
    });

    // admin2 (requester) tries to approve — must fail with FORBIDDEN
    await expect(
      approvalsService.approveRequest(
        buildContext({ user: { id: admin2.id }, session: { id: "sess-self" }, roles: ["admin"] }),
        { approvalRequestId, comment: null },
      ),
    ).rejects.toThrow();
  });

  it("succeeds when a different admin approves", async () => {
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

    // Issue invoice and post order paid for finance flow
    await createInvoice({ order });
    const { financeService } = await import("@/modules/finance/service");
    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    const proposeCtx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-1" },
      roles: ["admin"],
    });

    const { approvalRequestId } = await paymentsService.proposeRefund(proposeCtx, {
      orderId: order.id,
      paymentId: payment.id,
      amountMinor: 10_000,
      reason: "Full refund",
      revokeEntitlements: false,
      policyException: false,
    });

    // admin2 approves — should work
    const approveCtx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-approver" },
      roles: ["admin"],
    });

    await expect(
      approvalsService.approveRequest(approveCtx, { approvalRequestId, comment: null }),
    ).resolves.not.toThrow();
  });
});
