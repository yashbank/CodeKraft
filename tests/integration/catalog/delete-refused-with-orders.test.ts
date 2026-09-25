import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { ErrorCode } from "@/lib/errors";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin, createUser } from "../../factories/users";
import { createOffering } from "../../factories/offerings";
import { createOrder } from "../../factories/commerce";

describe("catalog delete refused with orders (BR-11, API-CAT-14, P3.9)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("refuses requestDelete up front when customer orders exist for the product", async () => {
    await truncateAll();
    const admin = await createAdmin();
    await createAdmin(); // Second admin for approval requirements

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-del-orders" },
      roles: ["admin"],
    });

    const { productId } = await catalogService.createProduct(adminCtx, {
      name: "Product With Purchases",
      slug: "product-with-purchases",
      shortDescription: "Has active orders",
    });

    const offering = await createOffering({
      productId,
      status: "active",
      methods: ["manual_upi"],
    });

    const customer = await createUser({ emailVerified: true });
    // Create an order containing this offering
    await createOrder({
      offering,
      user: customer,
      status: "paid",
    });

    // Attempting requestDelete must throw STATE_INVALID
    await expect(
      catalogService.requestDelete(adminCtx, {
        productId,
        reason: "Discontinuing product",
      }),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: ErrorCode.STATE_INVALID,
      }),
    );
  });
});
