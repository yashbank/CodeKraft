import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { ordersService } from "@/modules/orders/service";
import { orders, payments } from "../../../drizzle/schema/commerce";
import { emailOutbox } from "../../../drizzle/schema/notifications";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

describe("failPayment integration (API-PAY-04)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("marks payment failed while keeping order pending_payment when alsoCancelOrder is false", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });
    const partner = await createPartner({ userId: admin.id });
    const product = await createProduct({ createdBy: admin.id });

    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 1000,
      createdBy: admin.id,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 10000, currency: "INR" },
    });

    const custCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust" },
      roles: ["user"],
    });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    const orderRes = await ordersService.createOrder(custCtx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: { name: "Cust", email: customer.email, country: "IN" },
    });

    const failRes = await paymentsService.failPayment(adminCtx, {
      paymentId: orderRes.payment.paymentId,
      reason: "Invalid UTR",
      alsoCancelOrder: false,
    });

    expect(failRes.payment.status).toBe("failed");
    expect(failRes.order.status).toBe("pending_payment");

    const [pmt] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, orderRes.payment.paymentId));
    expect(pmt!.status).toBe("failed");
    expect(pmt!.failureReason).toBe("Invalid UTR");

    const [ord] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderRes.orderId));
    expect(ord!.status).toBe("pending_payment");

    // Email outbox check
    const emails = await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.template, "payment-failed"));
    expect(emails.length).toBeGreaterThanOrEqual(1);
  });

  it("cancels order when alsoCancelOrder is true", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });
    const partner = await createPartner({ userId: admin.id });
    const product = await createProduct({ createdBy: admin.id });

    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 1000,
      createdBy: admin.id,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 10000, currency: "INR" },
    });

    const custCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust" },
      roles: ["user"],
    });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    const orderRes = await ordersService.createOrder(custCtx, {
      offeringId: offering.id,
      paymentMethod: "manual_bank",
      billing: { name: "Cust", email: customer.email, country: "IN" },
    });

    const failRes = await paymentsService.failPayment(adminCtx, {
      paymentId: orderRes.payment.paymentId,
      reason: "Suspected fraud",
      alsoCancelOrder: true,
    });

    expect(failRes.payment.status).toBe("failed");
    expect(failRes.order.status).toBe("cancelled");

    const [ord] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderRes.orderId));
    expect(ord!.status).toBe("cancelled");
  });
});
