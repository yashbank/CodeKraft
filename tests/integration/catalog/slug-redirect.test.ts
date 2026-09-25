import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { resolveRedirect } from "@/modules/catalog/redirects";
import { createAdmin } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("catalog slug redirects (FR-SEO, MASTER_SPEC §7, PHASE-03 P3.6)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("records 301 redirect data when slug changes and resolves chained redirects", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-slug" },
      roles: ["admin"],
    });

    // 1. Create product with initial slug
    const createRes = await catalogService.createProduct(adminCtx, {
      name: "Original Product",
      slug: "original-product-slug",
      shortDescription: "Original description",
    });

    const graph1 = await catalogService.getProductAdmin(adminCtx, {
      productId: createRes.productId,
    });

    // 2. Change slug to second-slug
    await catalogService.updateProduct(adminCtx, {
      productId: createRes.productId,
      expectedUpdatedAt: graph1.product.updatedAt.toISOString(),
      patch: {
        slug: "second-product-slug",
      },
    });

    // Verify resolveRedirect resolves original -> second
    const redirect1 = await resolveRedirect("product", "original-product-slug");
    expect(redirect1).toBe("second-product-slug");

    const graph2 = await catalogService.getProductAdmin(adminCtx, {
      productId: createRes.productId,
    });

    // 3. Change slug again to third-slug
    await catalogService.updateProduct(adminCtx, {
      productId: createRes.productId,
      expectedUpdatedAt: graph2.product.updatedAt.toISOString(),
      patch: {
        slug: "third-product-slug",
      },
    });

    // Verify both original and second resolve to third
    const redirectFromOriginal = await resolveRedirect("product", "original-product-slug");
    const redirectFromSecond = await resolveRedirect("product", "second-product-slug");

    expect(redirectFromOriginal).toBe("third-product-slug");
    expect(redirectFromSecond).toBe("third-product-slug");

    // Resolving third (current slug) returns null (not redirected)
    const currentRedirect = await resolveRedirect("product", "third-product-slug");
    expect(currentRedirect).toBeNull();
  });
});
