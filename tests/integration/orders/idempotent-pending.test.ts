import { beforeAll, describe, expect, it } from "vitest";
import { ordersService } from "@/modules/orders/service";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

describe("idempotent pending order checkout (API-COM-02, docs/06 §1.5)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("returns existing pending order and payment when calling createOrder again for the same offering", async () => {
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
      price: { amountMinor: 7500, currency: "INR" },
    });

    const ctx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust-idem" },
      roles: ["user"],
    });

    // First call: creates initial order
    const order1 = await ordersService.createOrder(ctx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: {
        name: "Test Customer",
        email: customer.email,
        country: "IN",
      },
    });

    expect(order1.orderId).toBeDefined();

    // Second call: should return identical orderId and orderNo
    const order2 = await ordersService.createOrder(ctx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: {
        name: "Test Customer",
        email: customer.email,
        country: "IN",
      },
    });

    expect(order2.orderId).toBe(order1.orderId);
    expect(order2.orderNo).toBe(order1.orderNo);
    expect(order2.payment.paymentId).toBe(order1.payment.paymentId);
  });
});
