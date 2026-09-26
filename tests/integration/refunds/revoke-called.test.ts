/**
 * revoke-called: full refund revokes active entitlements for order items.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db, withTx } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { approvalsService } from "@/modules/approvals/service";
import { buildContext } from "@/lib/authz/context";
import { orderItems } from "../../../drizzle/schema/commerce";
import { entitlements } from "../../../drizzle/schema/delivery";
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

describe("applyRefund — entitlement revocation", () => {
  it("full refund revokes active entitlements for order items", async () => {
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

    // Post ledger
    const { financeService } = await import("@/modules/finance/service");
    await withTx(async (tx) => {
      await financeService.postOrderPaid(order.id, tx);
    });

    // Manually create an active entitlement for the order item
    const [item] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    const user = { id: order.userId! };
    if (item) {
      await db.insert(entitlements).values({
        userId: user.id,
        offeringId: item.offeringId,
        productId: item.productId!,
        orderItemId: item.id,
        deliveryType: "download",
        status: "active",
        updatePolicy: "all_free",
        accessStartsAt: new Date(),
      });
    }

    const ctx1 = buildContext({ user: { id: admin1.id }, session: { id: "s1" }, roles: ["admin"] });
    const ctx2 = buildContext({ user: { id: admin2.id }, session: { id: "s2" }, roles: ["admin"] });

    const { approvalRequestId } = await paymentsService.proposeRefund(ctx1, {
      orderId: order.id,
      paymentId: payment.id,
      amountMinor: 10_000,
      reason: "Full refund with entitlement revoke",
      revokeEntitlements: true,
      policyException: false,
    });

    await approvalsService.approveRequest(ctx2, { approvalRequestId, comment: null });

    // All entitlements for this order's items should be revoked
    if (item) {
      const [ent] = await db
        .select()
        .from(entitlements)
        .where(eq(entitlements.orderItemId, item.id));
      expect(ent?.status).toBe("revoked");
      expect(ent?.revokedAt).not.toBeNull();
      expect(ent?.revokeReason).toBe("refund");
    }
  });
});
