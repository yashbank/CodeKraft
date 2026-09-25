import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createProduct, tiptapParagraph } from "../../factories/catalog";
import { blogService } from "@/modules/blog/service";
import { ErrorCode } from "@/lib/errors";

describe("Blog - public reads (API-CAT-33, API-CAT-34, FR-SEO-02)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  it("lists published blog posts with pagination and teaser limits", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-pub-reads" },
      roles: ["admin"],
    });

    const p1 = await createProduct({ createdBy: admin.id, status: "published" });
    const p2 = await createProduct({ createdBy: admin.id, status: "published" });

    // Blog 1: published
    await blogService.upsertProductBlog(adminCtx, {
      productId: p1.id,
      slug: `blog-${p1.slug}`,
      title: "Published Post 1",
      excerpt: "Excerpt 1",
      bodyJson: tiptapParagraph("Content 1") as any,
    });
    await blogService.publishProductBlog(adminCtx, { productId: p1.id });

    // Blog 2: draft (should not appear in public reads)
    await blogService.upsertProductBlog(adminCtx, {
      productId: p2.id,
      slug: `blog-${p2.slug}`,
      title: "Draft Post 2",
      excerpt: "Excerpt 2",
      bodyJson: tiptapParagraph("Content 2") as any,
    });

    // 1. listBlogPosts only contains published posts
    const listResult = await blogService.listBlogPosts({} as any, { limit: 10 });
    const foundP1 = listResult.items.find((item) => item.slug === `blog-${p1.slug}`);
    const foundP2 = listResult.items.find((item) => item.slug === `blog-${p2.slug}`);

    expect(foundP1).toBeDefined();
    expect(foundP2).toBeUndefined();

    // 2. listBlogTeasers returns teasers
    const teasers = await blogService.listBlogTeasers({} as any, { limit: 5 });
    const teaserP1 = teasers.find((item) => item.slug === `blog-${p1.slug}`);
    expect(teaserP1).toBeDefined();
    expect(teaserP1?.title).toBe("Published Post 1");

    // 3. getBlogBySlug returns full details including rendered HTML and JSON-LD
    const detail = await blogService.getBlogBySlug({} as any, {
      slug: `blog-${p1.slug}`,
      displayCurrency: "INR",
    });

    expect(detail.blog.title).toBe("Published Post 1");
    expect(detail.product.slug).toBe(p1.slug);
    expect(detail.html).toContain("<p>Content 1</p>");
    expect(detail.jsonLd["@type"]).toBe("Article");
    expect(detail.jsonLd["headline"]).toBe("Published Post 1");

    // 4. getBlogBySlug on a draft post throws NOT_FOUND
    await expect(
      blogService.getBlogBySlug({} as any, {
        slug: `blog-${p2.slug}`,
        displayCurrency: "INR",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });
});
