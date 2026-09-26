import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ordersService } from "@/modules/orders/service";
import { orders, payments } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

describe("orders expiry service (MASTER_SPEC §7, docs/06 §2.3)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("marks expired pending orders as failed and open payments as failed (expired)", async () => {
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

    const ctx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust-exp" },
      roles: ["user"],
    });

    const createRes = await ordersService.createOrder(ctx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: {
        name: "Test Customer",
        email: customer.email,
        country: "IN",
      },
    });

    // 1. Manually set expiresAt in the past (e.g. 1 hour ago)
    const oneHourAgo = new Date(Date.now() - 3600_000);
    await db
      .update(orders)
      .set({ expiresAt: oneHourAgo })
      .where(eq(orders.id, createRes.orderId));

    // 2. Run expiry service
    const expiryRes = await ordersService.expirePendingOrders();
    expect(expiryRes.expiredOrderIds).toContain(createRes.orderId);

    // 3. Verify DB state: order is failed, payment is failed with failureReason = 'expired'
    const [dbOrder] = await db.select().from(orders).where(eq(orders.id, createRes.orderId));
    expect(dbOrder!.status).toBe("failed");

    const [dbPayment] = await db.select().from(payments).where(eq(payments.orderId, createRes.orderId));
    expect(dbPayment!.status).toBe("failed");
    expect(dbPayment!.failureReason).toBe("expired");
  });
});
