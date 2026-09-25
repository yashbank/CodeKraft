import { beforeAll, describe, expect, it } from "vitest";
import { anonymousContext } from "@/lib/authz/context";
import { searchService } from "@/modules/search/service";
import { createCategory, createProduct } from "../../factories/catalog";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("catalog search & listings (API-CAT-30, D-314, S-11, PHASE-03 P3.6)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("excludes unlisted and non-published products from visitor searches", async () => {
    await truncateAll();
    const visitorCtx = anonymousContext();

    // 1. Published and listed -> should appear
    await createProduct({
      name: "Public Starter Kit",
      slug: "public-starter-kit",
      status: "published",
      isUnlisted: false,
    });

    // 2. Published but unlisted -> MUST NOT appear in list/search
    await createProduct({
      name: "Unlisted Secret Tool",
      slug: "unlisted-secret-tool",
      status: "published",
      isUnlisted: true,
    });

    // 3. Draft product -> MUST NOT appear
    await createProduct({
      name: "Draft In Progress",
      slug: "draft-in-progress",
      status: "draft",
    });

    const res = await searchService.listProducts(visitorCtx, {
      displayCurrency: "INR",
      limit: 10,
      sort: "newest",
    });

    expect(res.items.length).toBe(1);
    expect(res.items[0]?.slug).toBe("public-starter-kit");
  });

  it("filters products by text search and category", async () => {
    await truncateAll();
    const visitorCtx = anonymousContext();

    const catMobile = await createCategory({ name: "Mobile Apps", slug: "mobile-apps" });
    const catWeb = await createCategory({ name: "Web Templates", slug: "web-templates" });

    await createProduct({
      name: "Flutter eCommerce App",
      slug: "flutter-ecommerce-app",
      shortDescription: "Complete cross-platform shop",
      categoryId: catMobile.id,
      status: "published",
    });

    await createProduct({
      name: "React Dashboard",
      slug: "react-dashboard",
      shortDescription: "Admin analytics template",
      categoryId: catWeb.id,
      status: "published",
    });

    // Search by category
    const mobileResults = await searchService.listProducts(visitorCtx, {
      filters: { categorySlug: "mobile-apps" },
      displayCurrency: "INR",
      limit: 10,
      sort: "newest",
    });

    expect(mobileResults.items.length).toBe(1);
    expect(mobileResults.items[0]?.slug).toBe("flutter-ecommerce-app");

    // Search by query text
    const textResults = await searchService.listProducts(visitorCtx, {
      q: "Flutter",
      displayCurrency: "INR",
      limit: 10,
      sort: "newest",
    });

    expect(textResults.items.length).toBe(1);
    expect(textResults.items[0]?.slug).toBe("flutter-ecommerce-app");
  });
});
