import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderExpiryJob } from "@/jobs/order-expiry";
import { orders } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { ordersService } from "@/modules/orders/service";
import { buildContext } from "@/lib/authz/context";

describe("orderExpiryJob integration (docs/06 §3.3, master plan §3)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("finds and expires pending orders whose expires_at is past", async () => {
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
      price: { amountMinor: 6000, currency: "INR" },
    });

    const ctx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust-job" },
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

    // Backdate expiresAt to 1 day ago
    const oneDayAgo = new Date(Date.now() - 86_400_000);
    await db
      .update(orders)
      .set({ expiresAt: oneDayAgo })
      .where(eq(orders.id, createRes.orderId));

    const result = await orderExpiryJob.run();
    expect(result.expiredCount).toBe(1);
    expect(result.expiredOrderIds).toContain(createRes.orderId);

    const [dbOrder] = await db.select().from(orders).where(eq(orders.id, createRes.orderId));
    expect(dbOrder!.status).toBe("failed");
  });
});
