import { beforeAll, describe, expect, it } from "vitest";
import { anonymousContext } from "@/lib/authz/context";
import { searchService } from "@/modules/search/service";
import { createCategory, createProduct } from "../../factories/catalog";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("catalog search facets (API-CAT-32, PHASE-03 P3.6)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("calculates category facets for published, listed products", async () => {
    await truncateAll();
    const visitorCtx = anonymousContext();

    const catBackend = await createCategory({ name: "Backend APIs", slug: "backend-apis" });
    const catFrontend = await createCategory({ name: "Frontend Themes", slug: "frontend-themes" });

    // 2 products in Backend
    await createProduct({ categoryId: catBackend.id, status: "published", isUnlisted: false });
    await createProduct({ categoryId: catBackend.id, status: "published", isUnlisted: false });

    // 1 product in Frontend
    await createProduct({ categoryId: catFrontend.id, status: "published", isUnlisted: false });

    // 1 draft product in Backend (must not increment count)
    await createProduct({ categoryId: catBackend.id, status: "draft" });

    const facets = await searchService.listFilterFacets(visitorCtx, {
      displayCurrency: "INR",
    });

    expect(facets.categories.length).toBeGreaterThanOrEqual(2);

    const backendFacet = facets.categories.find((c) => c.slug === "backend-apis");
    const frontendFacet = facets.categories.find((c) => c.slug === "frontend-themes");

    expect(backendFacet?.count).toBe(2);
    expect(frontendFacet?.count).toBe(1);
  });
});
