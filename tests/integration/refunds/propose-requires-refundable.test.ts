/**
 * propose-requires-refundable: BR-09 — non-refundable product refused without policyException. (@security SA-08)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { buildContext } from "@/lib/authz/context";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOrder, createPayment } from "../../factories/commerce";

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

describe("proposeRefund — BR-09 refundable guard", () => {
  it("refuses refund on non-refundable product without policyException", async () => {
    const admin1 = await createAdmin();
    const admin2 = await createAdmin();

    const product = await createProduct({
      isRefundable: false,
      createdBy: admin1.id,
    });
    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 10_000, currency: "INR" },
    });
    const order = await createOrder({
      offering,
      status: "paid",
    });
    const payment = await createPayment({ order, status: "confirmed" });

    const ctx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-1" },
      roles: ["admin"],
    });

    await expect(
      paymentsService.proposeRefund(ctx, {
        orderId: order.id,
        paymentId: payment.id,
        amountMinor: 10_000,
        reason: "Customer unhappy",
        revokeEntitlements: true,
        policyException: false,
      }),
    ).rejects.toThrow(/non-refundable/i);
  });

  it("allows refund on non-refundable product with policyException", async () => {
    const admin1 = await createAdmin();
    const admin2 = await createAdmin();

    const product = await createProduct({
      isRefundable: false,
      createdBy: admin1.id,
    });
    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 10_000, currency: "INR" },
    });
    const order = await createOrder({
      offering,
      status: "paid",
    });
    const payment = await createPayment({ order, status: "confirmed" });

    const ctx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-2" },
      roles: ["admin"],
    });

    const result = await paymentsService.proposeRefund(ctx, {
      orderId: order.id,
      paymentId: payment.id,
      amountMinor: 10_000,
      reason: "Exception approved by director",
      revokeEntitlements: true,
      policyException: true,
    });

    expect(result.refundId).toBeDefined();
    expect(result.approvalRequestId).toBeDefined();
  });
});
