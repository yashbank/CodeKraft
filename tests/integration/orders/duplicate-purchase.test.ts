import { beforeAll, describe, expect, it } from "vitest";
import { ordersService } from "@/modules/orders/service";
import { userOfferingPurchases } from "../../../drizzle/schema/commerce";
import { db } from "@/lib/db";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";
import { AppError, ErrorCode } from "@/lib/errors";

describe("duplicate purchase prevention (BR-10, docs/06 §2.3)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("throws DUPLICATE_PURCHASE when purchasing an already owned one-time offering", async () => {
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
      purchaseModel: "one_time",
    });

    const ctx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust-dp" },
      roles: ["user"],
    });

    // 1. Order and simulate completed purchase by inserting into userOfferingPurchases
    const orderRes = await ordersService.createOrder(ctx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: {
        name: "Test Customer",
        email: customer.email,
        country: "IN",
      },
    });

    await db.insert(userOfferingPurchases).values({
      userId: customer.id,
      offeringId: offering.id,
      orderId: orderRes.orderId,
    });

    // 2. Attempt to previewCheckout or createOrder again -> expect DUPLICATE_PURCHASE
    await expect(
      ordersService.previewCheckout(ctx, { offeringId: offering.id }),
    ).rejects.toMatchObject({
      code: ErrorCode.DUPLICATE_PURCHASE,
    });

    await expect(
      ordersService.createOrder(ctx, {
        offeringId: offering.id,
        paymentMethod: "manual_upi",
        billing: {
          name: "Test Customer",
          email: customer.email,
          country: "IN",
        },
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.DUPLICATE_PURCHASE,
    });
  });
});
