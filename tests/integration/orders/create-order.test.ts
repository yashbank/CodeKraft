import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ordersService } from "@/modules/orders/service";
import { orders, orderItems, payments } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

describe("orders creation & manual payment integration (API-COM-01, API-COM-04, docs/06 §2.3)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("previews order calculation with tax and billing snapshot", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer = await createUser();
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

    const ctx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust-1" },
      roles: ["user"],
    });

    const preview = await ordersService.previewCheckout(ctx, {
      offeringId: offering.id,
    });

    expect(preview.lines).toHaveLength(1);
    expect(preview.lines[0]!.unitMinor).toBe(10000);
    expect(preview.tax.currency).toBe("INR");
    expect(preview.total.amountMinor).toBeGreaterThanOrEqual(10000);
  });

  it("creates order with manual UPI payment and instructions", async () => {
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
      session: { id: "sess-cust-2" },
      roles: ["user"],
    });

    const result = await ordersService.createOrder(ctx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: {
        name: "Test Customer",
        email: customer.email,
        country: "IN",
      },
    });

    expect(result.orderNo).toMatch(/^CK-ORD-\d{6}$/);
    expect(result.payment.method).toBe("manual_upi");
    expect(result.payment.instructions).toBeDefined();

    // Verify DB state
    const [savedOrder] = await db.select().from(orders).where(eq(orders.id, result.orderId));
    expect(savedOrder).toBeDefined();
    expect(savedOrder!.status).toBe("pending_payment");
    expect(savedOrder!.userId).toBe(customer.id);

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, result.orderId));
    expect(items).toHaveLength(1);
    expect(items[0]!.offeringId).toBe(offering.id);

    const paymentRows = await db.select().from(payments).where(eq(payments.orderId, result.orderId));
    expect(paymentRows).toHaveLength(1);
    expect(paymentRows[0]!.status).toBe("initiated");
  });
});
