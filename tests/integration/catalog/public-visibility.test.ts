import { beforeAll, describe, expect, it } from "vitest";
import { anonymousContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { AppError } from "@/lib/errors";
import { createProduct } from "../../factories/catalog";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

function assertNoOwnershipKey(obj: unknown, path = ""): void {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => assertNoOwnershipKey(item, `${path}[${idx}]`));
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    expect(key.toLowerCase(), `Forbidden ownership key exposed at ${currentPath}`).not.toBe(
      "ownership",
    );
    assertNoOwnershipKey(value, currentPath);
  }
}

describe("catalog public visibility & BR-02 data isolation (API-CAT-31, BR-02, PHASE-03 P3.6)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("returns 404 NOT_FOUND for draft, pending_approval, scheduled, archived products", async () => {
    await truncateAll();
    const visitorCtx = anonymousContext();

    // Draft
    const draft = await createProduct({ status: "draft" });
    await expect(
      catalogService.getProductBySlug(visitorCtx, {
        slug: draft.slug,
        displayCurrency: "INR",
      }),
    ).rejects.toThrowError(AppError);

    // Pending approval
    const pending = await createProduct({ status: "pending_approval" });
    await expect(
      catalogService.getProductBySlug(visitorCtx, {
        slug: pending.slug,
        displayCurrency: "INR",
      }),
    ).rejects.toThrowError(AppError);

    // Scheduled
    const scheduled = await createProduct({ status: "scheduled" });
    await expect(
      catalogService.getProductBySlug(visitorCtx, {
        slug: scheduled.slug,
        displayCurrency: "INR",
      }),
    ).rejects.toThrowError(AppError);

    // Archived
    const archived = await createProduct({ status: "archived" });
    await expect(
      catalogService.getProductBySlug(visitorCtx, {
        slug: archived.slug,
        displayCurrency: "INR",
      }),
    ).rejects.toThrowError(AppError);
  });

  it("allows public access to published products and strictly satisfies BR-02 (no ownership data)", async () => {
    await truncateAll();
    const visitorCtx = anonymousContext();

    const published = await createProduct({
      status: "published",
      name: "Public Enterprise Template",
      slug: "public-enterprise-template",
      shortDescription: "A fully published product for everyone",
      ownership: {
        companyCutBps: 2000,
        status: "active",
      },
    });

    const detail = await catalogService.getProductBySlug(visitorCtx, {
      slug: published.slug,
      displayCurrency: "INR",
    });

    expect(detail).toBeDefined();
    expect(detail.id).toBe(published.id);
    expect(detail.slug).toBe("public-enterprise-template");
    expect(detail.name).toBe("Public Enterprise Template");

    // CRITICAL: BR-02 enforcement check
    assertNoOwnershipKey(detail);
  });

  it("unlisted published products are reachable by direct slug (S-11 step 5)", async () => {
    await truncateAll();
    const visitorCtx = anonymousContext();

    const unlisted = await createProduct({
      status: "published",
      isUnlisted: true,
      name: "Private VIP Product",
      slug: "private-vip-product",
    });

    const detail = await catalogService.getProductBySlug(visitorCtx, {
      slug: unlisted.slug,
      displayCurrency: "INR",
    });

    expect(detail).toBeDefined();
    expect(detail.isUnlisted).toBe(true);
    expect(detail.slug).toBe("private-vip-product");

    assertNoOwnershipKey(detail);
  });
});
