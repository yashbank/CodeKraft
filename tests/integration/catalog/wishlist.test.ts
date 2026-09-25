import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("catalog wishlist operations (API-CAT-35, API-CAT-36, PHASE-03 P3.6)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("toggles product on and off in user's wishlist and lists wishlisted items", async () => {
    await truncateAll();
    const customer = await createUser({ role: "customer" });
    const customerCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-wishlist" },
      roles: ["customer"],
    });

    const product = await createProduct({
      name: "SaaS Boilerplate",
      slug: "saas-boilerplate",
      status: "published",
    });

    // 1. Initially wishlist is empty
    const initialList = await catalogService.listMyWishlist(customerCtx, {
      limit: 20,
      displayCurrency: "INR",
    });
    expect(initialList.items.length).toBe(0);

    // 2. Add to wishlist
    const addRes = await catalogService.toggleWishlist(customerCtx, {
      productId: product.id,
      on: true,
    });
    expect(addRes.wishlisted).toBe(true);

    const afterAddList = await catalogService.listMyWishlist(customerCtx, {
      limit: 20,
      displayCurrency: "INR",
    });
    expect(afterAddList.items.length).toBe(1);
    expect(afterAddList.items[0]?.slug).toBe("saas-boilerplate");

    // 3. Remove from wishlist
    const removeRes = await catalogService.toggleWishlist(customerCtx, {
      productId: product.id,
      on: false,
    });
    expect(removeRes.wishlisted).toBe(false);

    const afterRemoveList = await catalogService.listMyWishlist(customerCtx, {
      limit: 20,
      displayCurrency: "INR",
    });
    expect(afterRemoveList.items.length).toBe(0);
  });
});
