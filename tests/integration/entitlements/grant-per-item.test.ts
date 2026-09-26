import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { entitlementsService } from "@/modules/entitlements/service";
import { entitlements, subscriptions } from "../../../drizzle/schema/delivery";
import { orders } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOrder } from "../../factories/commerce";

describe("Entitlements grantForOrder (FR-DEL-01, API-DEL-01, MASTER_SPEC §7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("creates exactly one entitlement per order item on payment confirmation", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const product = await createProduct({ createdBy: admin.id });
    const offering = await createOffering({
      productId: product.id,
      deliveryType: "download",
      price: { amountMinor: 20000, currency: "INR" },
    });
    const buyer = await createUser({ emailVerified: true });

    const order = await createOrder({
      offering,
      user: buyer,
      status: "paid",
    });

    const granted = await withTx(async (tx) => {
      return await entitlementsService.grantForOrder(order.id, tx);
    });

    expect(granted).toHaveLength(1);
    expect(granted[0]!.deliveryType).toBe("download");
    expect(granted[0]!.status).toBe("active");

    // Idempotency: re-running grantForOrder returns existing row without creating new one
    const secondGrant = await withTx(async (tx) => {
      return await entitlementsService.grantForOrder(order.id, tx);
    });

    expect(secondGrant).toHaveLength(1);
    expect(secondGrant[0]!.entitlementId).toBe(granted[0]!.entitlementId);

    const allEnts = await db.select().from(entitlements).where(eq(entitlements.userId, buyer.id));
    expect(allEnts).toHaveLength(1);
  });

  it("creates a subscription row when purchasing a subscription offering", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const product = await createProduct({ createdBy: admin.id });
    const subOffering = await createOffering({
      productId: product.id,
      purchaseModel: "subscription",
      billingInterval: "monthly",
      deliveryType: "saas",
      price: { amountMinor: 30000, currency: "INR" },
    });
    const buyer = await createUser({ emailVerified: true });

    const order = await createOrder({
      offering: subOffering,
      user: buyer,
      status: "paid",
    });

    const granted = await withTx(async (tx) => {
      return await entitlementsService.grantForOrder(order.id, tx);
    });

    expect(granted).toHaveLength(1);
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.entitlementId, granted[0]!.entitlementId));

    expect(sub).toBeDefined();
    expect(sub?.status).toBe("active");
    expect(sub?.interval).toBe("monthly");
  });
});
