import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentsService } from "@/modules/payments/service";
import { ordersService } from "@/modules/orders/service";
import { notifications } from "../../../drizzle/schema/notifications";
import { payments } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

describe("submitPaymentReference integration (API-PAY-02)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("submits UTR reference, updates status to submitted, and notifies admin", async () => {
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
      price: { amountMinor: 5000, currency: "INR" },
    });

    const custCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust" },
      roles: ["user"],
    });

    const orderRes = await ordersService.createOrder(custCtx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: { name: "Cust", email: customer.email, country: "IN" },
    });

    const submitRes = await paymentsService.submitPaymentReference(custCtx, {
      paymentId: orderRes.payment.paymentId,
      reference: "UTR123456789",
    });

    expect(submitRes.payment.status).toBe("submitted");

    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, orderRes.payment.paymentId));
    expect(row!.status).toBe("submitted");
    expect(row!.customerReference).toBe("UTR123456789");
    expect(row!.customerSubmittedAt).toBeDefined();

    // Check notifications sent to admin
    const notifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.type, "payment.submitted"));
    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(notifs[0]!.payload).toMatchObject({
      paymentId: orderRes.payment.paymentId,
      reference: "UTR123456789",
    });
  });

  it("rejects reference submission by foreign customer", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer1 = await createUser({ emailVerified: true });
    const customer2 = await createUser({ emailVerified: true });
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
      price: { amountMinor: 5000, currency: "INR" },
    });

    const ctx1 = buildContext({
      user: { id: customer1.id },
      session: { id: "sess-1" },
      roles: ["user"],
    });
    const ctx2 = buildContext({
      user: { id: customer2.id },
      session: { id: "sess-2" },
      roles: ["user"],
    });

    const orderRes = await ordersService.createOrder(ctx1, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: { name: "Cust1", email: customer1.email, country: "IN" },
    });

    await expect(
      paymentsService.submitPaymentReference(ctx2, {
        paymentId: orderRes.payment.paymentId,
        reference: "UTR999999999",
      }),
    ).rejects.toThrow("Payment not found");
  });
});
