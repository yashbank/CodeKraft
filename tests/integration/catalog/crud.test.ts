import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { AppError, ErrorCode } from "@/lib/errors";
import { createAdmin } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("catalog CRUD operations & optimistic locking (API-CAT-01..09, 13, PHASE-03 P3.6)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("creates, updates, and creates version for products with optimistic concurrency", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-crud" },
      roles: ["admin"],
    });

    // 1. Create draft product
    const createRes = await catalogService.createProduct(adminCtx, {
      name: "Acme Analytics Starter",
      slug: "acme-analytics-starter",
      shortDescription: "Complete analytics toolkit for Next.js",
      tags: ["nextjs", "analytics"],
    });

    expect(createRes.productId).toBeDefined();
    expect(createRes.status).toBe("draft");

    // 2. Read admin graph
    const graph = await catalogService.getProductAdmin(adminCtx, {
      productId: createRes.productId,
    });
    expect(graph.product.name).toBe("Acme Analytics Starter");
    expect(graph.product.status).toBe("draft");
    expect(graph.tags.length).toBe(2);

    // 3. Update product with valid expectedUpdatedAt
    const updateRes = await catalogService.updateProduct(adminCtx, {
      productId: createRes.productId,
      expectedUpdatedAt: graph.product.updatedAt.toISOString(),
      patch: {
        shortDescription: "Updated short description for analytics",
        isComingSoon: true,
      },
    });

    expect(updateRes.product.shortDescription).toBe("Updated short description for analytics");
    expect(updateRes.product.isComingSoon).toBe(true);

    // 4. Stale update with previous timestamp -> must throw CONFLICT
    await expect(
      catalogService.updateProduct(adminCtx, {
        productId: createRes.productId,
        expectedUpdatedAt: graph.product.updatedAt.toISOString(), // Stale!
        patch: {
          shortDescription: "Should be rejected due to concurrent edit",
        },
      }),
    ).rejects.toThrowError(AppError);

    try {
      await catalogService.updateProduct(adminCtx, {
        productId: createRes.productId,
        expectedUpdatedAt: graph.product.updatedAt.toISOString(),
        patch: { shortDescription: "Fail" },
      });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.CONFLICT);
    }

    // 5. Create product version
    const versionRes = await catalogService.createProductVersion(adminCtx, {
      productId: createRes.productId,
      version: "1.0.0",
      changelogJson: {
        summary: "Initial release",
        added: ["Core analytics tracking", "Dashboard component"],
      },
    });

    expect(versionRes.version.version).toBe("1.0.0");
    expect(versionRes.version.changelog?.summary).toBe("Initial release");

    // 6. Duplicate version -> throws CONFLICT
    await expect(
      catalogService.createProductVersion(adminCtx, {
        productId: createRes.productId,
        version: "1.0.0",
        changelogJson: { summary: "Duplicate" },
      }),
    ).rejects.toThrowError(AppError);
  });

  it("handles FAQs and Testimonials CRUD", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-crud-faqs" },
      roles: ["admin"],
    });

    const createRes = await catalogService.createProduct(adminCtx, {
      name: "CRM Dashboard",
      slug: "crm-dashboard",
      shortDescription: "Modern CRM template",
    });

    // FAQs
    const faq1 = await catalogService.upsertProductFaq(adminCtx, {
      productId: createRes.productId,
      question: "Is TypeScript supported?",
      answerJson: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Yes, 100% strict." }] }],
      },
      position: 0,
    });
    expect(faq1.faqs.length).toBe(1);
    expect(faq1.faqs[0]?.question).toBe("Is TypeScript supported?");

    // Testimonials
    const test1 = await catalogService.upsertProductTestimonial(adminCtx, {
      productId: createRes.productId,
      authorName: "Sarah Connor",
      company: "Tech Corp",
      quote: "Saved us 3 months of dev time!",
      position: 0,
      published: true,
    });
    expect(test1.testimonials.length).toBe(1);
    expect(test1.testimonials[0]?.authorName).toBe("Sarah Connor");
  });
});
