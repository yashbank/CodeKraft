import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createProduct, tiptapParagraph } from "../../factories/catalog";
import { blogService } from "@/modules/blog/service";
import { productBlogs } from "../../../drizzle/schema";
import { ErrorCode } from "@/lib/errors";
import { toFactoryDb } from "../../factories/context";

describe("Blog - one per product (D-121, D-804, API-CAT-10)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  it("upserts blog for a product and updates on subsequent calls instead of duplicating", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-1" },
      roles: ["admin"],
    });

    const product = await createProduct({ createdBy: admin.id });

    // Initial upsert
    const res1 = await blogService.upsertProductBlog(adminCtx, {
      productId: product.id,
      slug: `blog-${product.slug}`,
      title: "First Post Title",
      excerpt: "First post excerpt",
      bodyJson: tiptapParagraph("This is the blog post content.") as any,
    });

    expect(res1.blog.id).toBeDefined();
    expect(res1.blog.productId).toBe(product.id);
    expect(res1.blog.title).toBe("First Post Title");
    expect(res1.blog.status).toBe("draft");

    // Second upsert for the same product updates the post
    const res2 = await blogService.upsertProductBlog(adminCtx, {
      productId: product.id,
      slug: `blog-${product.slug}`,
      title: "Updated Post Title",
      excerpt: "Updated excerpt",
      bodyJson: tiptapParagraph("Updated blog content.") as any,
    });

    expect(res2.blog.id).toBe(res1.blog.id);
    expect(res2.blog.title).toBe("Updated Post Title");
    expect(res2.blog.excerpt).toBe("Updated excerpt");

    // Exactly one row exists in DB for this product
    const drizzleDb = toFactoryDb();
    const rows = await drizzleDb.select().from(productBlogs);
    const productPosts = rows.filter((r) => r.productId === product.id);
    expect(productPosts.length).toBe(1);
  });

  it("refuses duplicate slug across different products with CONFLICT", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-2" },
      roles: ["admin"],
    });

    const product1 = await createProduct({ createdBy: admin.id });
    const product2 = await createProduct({ createdBy: admin.id });

    const sharedSlug = `unique-shared-slug-${Date.now()}`;

    // First product gets the slug
    await blogService.upsertProductBlog(adminCtx, {
      productId: product1.id,
      slug: sharedSlug,
      title: "Blog 1",
      excerpt: "Excerpt 1",
      bodyJson: tiptapParagraph("Content 1") as any,
    });

    // Second product trying to take the same slug is rejected with CONFLICT
    await expect(
      blogService.upsertProductBlog(adminCtx, {
        productId: product2.id,
        slug: sharedSlug,
        title: "Blog 2",
        excerpt: "Excerpt 2",
        bodyJson: tiptapParagraph("Content 2") as any,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
    });
  });

  it("database unique constraint rejects second blog insertion for the same product", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const product = await createProduct({ createdBy: admin.id });
    const drizzleDb = toFactoryDb();

    // First insert directly to DB
    await drizzleDb.insert(productBlogs).values({
      productId: product.id,
      slug: `direct-slug-1-${Date.now()}`,
      title: "Direct Blog 1",
      authorId: admin.id,
    });

    // Attempting a second insert for the same product_id violates unique constraint
    await expect(
      drizzleDb.insert(productBlogs).values({
        productId: product.id,
        slug: `direct-slug-2-${Date.now()}`,
        title: "Direct Blog 2",
        authorId: admin.id,
      }),
    ).rejects.toThrow();
  });
});
