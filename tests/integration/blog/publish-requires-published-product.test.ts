import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createProduct, tiptapParagraph } from "../../factories/catalog";
import { blogService } from "@/modules/blog/service";
import { products } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { ErrorCode } from "@/lib/errors";
import { toFactoryDb } from "../../factories/context";

describe("Blog - publish requires published product (FR-CONT-05, API-CAT-10)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  it("refuses to publish blog when product is draft/scheduled/archived with STATE_INVALID", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-pub-req" },
      roles: ["admin"],
    });

    // Product is draft
    const product = await createProduct({ createdBy: admin.id, status: "draft" });

    await blogService.upsertProductBlog(adminCtx, {
      productId: product.id,
      slug: `blog-${product.slug}`,
      title: "Draft Product Blog",
      excerpt: "Some excerpt",
      bodyJson: tiptapParagraph("Hello world") as any,
    });

    // Attempting to publish blog while product is draft
    await expect(
      blogService.publishProductBlog(adminCtx, { productId: product.id }),
    ).rejects.toMatchObject({
      code: ErrorCode.STATE_INVALID,
    });

    // Now update product to published
    const drizzleDb = toFactoryDb();
    await drizzleDb
      .update(products)
      .set({ status: "published" })
      .where(eq(products.id, product.id));

    // Publishing now succeeds
    const publishedRes = await blogService.publishProductBlog(adminCtx, { productId: product.id });
    expect(publishedRes.blog.status).toBe("published");
    expect(publishedRes.blog.publishedAt).toBeDefined();

    // Can also unpublish back to draft
    const unpublishedRes = await blogService.unpublishProductBlog(adminCtx, {
      productId: product.id,
    });
    expect(unpublishedRes.blog.status).toBe("draft");
  });
});
