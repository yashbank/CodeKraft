import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { offeringsService } from "@/modules/offerings/service";
import { createAdmin } from "../../factories/users";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { db } from "@/lib/db";
import { orderItems, orders } from "../../../drizzle/schema/commerce";
import { offerings } from "../../../drizzle/schema/offerings";

describe("offerings CRUD & deletion safety (API-CAT-03, PHASE-03 P3.7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("handles upsertOffering, default switching, and safe deletion vs inactivation", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-offering-crud" },
      roles: ["admin"],
    });

    // 1. Create a product first
    const prodRes = await catalogService.createProduct(adminCtx, {
      name: "Offering Host Product",
      slug: "offering-host-product",
      shortDescription: "Product to host test offerings",
    });

    // 2. Create offering A
    const offA = await offeringsService.upsertOffering(adminCtx, {
      productId: prodRes.productId,
      name: "Starter Tier",
      slug: "starter-tier",
      position: 0,
      isDefault: true,
      purchaseModel: "one_time",
      deliveryType: "download",
      deliveryConfig: {
        provisioning: "manual",
        updatePolicy: "all_free",
      },
      status: "active",
    });

    expect(offA.offering.id).toBeDefined();
    expect(offA.offering.isDefault).toBe(true);

    // 3. Create offering B with isDefault: true (should unset A's isDefault)
    const offB = await offeringsService.upsertOffering(adminCtx, {
      productId: prodRes.productId,
      name: "Pro Tier",
      slug: "pro-tier",
      position: 1,
      isDefault: true,
      purchaseModel: "one_time",
      deliveryType: "download",
      deliveryConfig: {
        provisioning: "manual",
        updatePolicy: "all_free",
      },
      status: "active",
    });

    expect(offB.offering.isDefault).toBe(true);

    const [refreshedA] = await db
      .select({ isDefault: offerings.isDefault })
      .from(offerings)
      .where(eq(offerings.id, offA.offering.id));
    expect(refreshedA?.isDefault).toBe(false);

    // 4. Delete offering A (has 0 orders -> hard deleted)
    const delResA = await offeringsService.deleteOffering(adminCtx, {
      offeringId: offA.offering.id,
    });
    expect(delResA.result).toBe("deleted");

    const [remainingA] = await db
      .select()
      .from(offerings)
      .where(eq(offerings.id, offA.offering.id));
    expect(remainingA).toBeUndefined();

    // 5. Simulate an existing order for offering B
    const [testOrder] = await db
      .insert(orders)
      .values({
        orderNo: "CK-ORD-999991",
        status: "paid",
        userId: admin.id,
        currency: "INR",
        subtotalMinor: 10000,
        taxMinor: 1800,
        totalMinor: 11800,
        billingSnapshot: { name: "Admin", email: "admin@example.com", country: "IN" },
        fxRateToInr: "1.00000000",
      })
      .returning();

    await db.insert(orderItems).values({
      orderId: testOrder!.id,
      offeringId: offB.offering.id,
      productId: prodRes.productId,
      description: "Pro Tier",
      quantity: 1,
      unitMinor: 10000,
      totalMinor: 10000,
    });

    // 6. Delete offering B (has order item -> demoted to inactive)
    const delResB = await offeringsService.deleteOffering(adminCtx, {
      offeringId: offB.offering.id,
    });
    expect(delResB.result).toBe("inactive");

    const [inactivatedB] = await db
      .select({ status: offerings.status })
      .from(offerings)
      .where(eq(offerings.id, offB.offering.id));
    expect(inactivatedB?.status).toBe("inactive");
  });
});
