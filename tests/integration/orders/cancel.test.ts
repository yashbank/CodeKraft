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
import { AppError, ErrorCode } from "@/lib/errors";

describe("cancelMyOrder integration (API-COM-03, docs/06 §2.3)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("cancels pending order and marks initiated payments failed", async () => {
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
      session: { id: "sess-cust-cancel" },
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

    const cancelRes = await ordersService.cancelMyOrder(ctx, {
      orderId: createRes.orderId,
    });

    expect(cancelRes.order.status).toBe("cancelled");
    expect(cancelRes.order.cancelledAt).toBeDefined();

    // Verify DB
    const [dbOrder] = await db.select().from(orders).where(eq(orders.id, createRes.orderId));
    expect(dbOrder!.status).toBe("cancelled");

    const [dbPayment] = await db.select().from(payments).where(eq(payments.orderId, createRes.orderId));
    expect(dbPayment!.status).toBe("failed");
    expect(dbPayment!.failureReason).toBe("cancelled");
  });

  it("cannot cancel an order belonging to another customer", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customerA = await createUser({ emailVerified: true });
    const customerB = await createUser({ emailVerified: true });
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

    const ctxA = buildContext({
      user: { id: customerA.id },
      session: { id: "sess-cust-a" },
      roles: ["user"],
    });

    const ctxB = buildContext({
      user: { id: customerB.id },
      session: { id: "sess-cust-b" },
      roles: ["user"],
    });

    const createRes = await ordersService.createOrder(ctxA, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: {
        name: "Customer A",
        email: customerA.email,
        country: "IN",
      },
    });

    await expect(
      ordersService.cancelMyOrder(ctxB, { orderId: createRes.orderId }),
    ).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });
});
