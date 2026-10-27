import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { getDb } from "@/lib/db";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createProduct, tiptapParagraph } from "../../factories/catalog";
import { blogService } from "@/modules/blog/service";
import { ErrorCode } from "@/lib/errors";
import { products } from "../../../drizzle/schema";

describe("Blog - unpublished product hidden (BUG-064), admin list (BUG-067)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("hides a published blog once its product is unpublished and lists it for admins", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-blog-vis" },
      roles: ["admin"],
    });
    const p1 = await createProduct({ createdBy: admin.id, status: "published" });
    const p2 = await createProduct({ createdBy: admin.id, status: "published" });
    for (const p of [p1, p2]) {
      await blogService.upsertProductBlog(ctx, {
        productId: p.id,
        slug: `blog-${p.slug}`,
        title: `Post ${p.slug}`,
        excerpt: "x",
        bodyJson: tiptapParagraph("body") as any,
      });
      await blogService.publishProductBlog(ctx, { productId: p.id });
    }
    await getDb().update(products).set({ status: "draft" }).where(eq(products.id, p2.id));

    const list = await blogService.listBlogPosts({} as any, { limit: 10 });
    expect(list.items.map((i) => i.slug)).toEqual([`blog-${p1.slug}`]);
    expect(list.total).toBe(1);
    const teasers = await blogService.listBlogTeasers({} as any, { limit: 5 });
    expect(teasers.map((i) => i.slug)).toEqual([`blog-${p1.slug}`]);
    await expect(
      blogService.getBlogBySlug({} as any, { slug: `blog-${p2.slug}`, displayCurrency: "INR" }),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });

    const p3 = await createProduct({ createdBy: admin.id, status: "draft" });
    const admin1 = await blogService.listBlogsAdmin(ctx);
    expect(admin1.posts).toHaveLength(2);
    expect(admin1.posts.every((p) => p.status === "published")).toBe(true);
    expect(admin1.productsWithoutBlog.map((p) => p.id)).toEqual([p3.id]);
  });
});
