import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createProduct, tiptapParagraph } from "../../factories/catalog";
import { blogService } from "@/modules/blog/service";
import { slugRedirects } from "../../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { toFactoryDb } from "../../factories/context";

describe("Blog - slug redirects (API-CAT-10, FR-SEO-02)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  it("records slug redirect when a published blog slug changes and resolves by old slug", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-slug-redir" },
      roles: ["admin"],
    });

    const product = await createProduct({ createdBy: admin.id, status: "published" });
    const initialSlug = `initial-blog-slug-${Date.now()}`;
    const newSlug = `updated-blog-slug-${Date.now()}`;

    // 1. Create and publish blog with initial slug
    await blogService.upsertProductBlog(adminCtx, {
      productId: product.id,
      slug: initialSlug,
      title: "Initial Blog Title",
      excerpt: "Initial excerpt",
      bodyJson: tiptapParagraph("Body content here.") as any,
    });

    await blogService.publishProductBlog(adminCtx, { productId: product.id });

    // 2. Change slug on the published blog
    await blogService.upsertProductBlog(adminCtx, {
      productId: product.id,
      slug: newSlug,
      title: "Updated Blog Title",
      excerpt: "Updated excerpt",
      bodyJson: tiptapParagraph("Body content here.") as any,
    });

    // 3. Verify slug_redirects entry exists
    const drizzleDb = toFactoryDb();
    const [redirect] = await drizzleDb
      .select()
      .from(slugRedirects)
      .where(
        and(
          eq(slugRedirects.entity, "blog"),
          eq(slugRedirects.oldSlug, initialSlug),
          eq(slugRedirects.newSlug, newSlug),
        ),
      );

    expect(redirect).toBeDefined();
    expect(redirect?.oldSlug).toBe(initialSlug);
    expect(redirect?.newSlug).toBe(newSlug);

    // 4. Calling getBlogBySlug with the OLD slug resolves the updated blog post
    const resolved = await blogService.getBlogBySlug({} as any, {
      slug: initialSlug,
      displayCurrency: "INR",
    });

    expect(resolved.blog.slug).toBe(newSlug);
    expect(resolved.blog.title).toBe("Updated Blog Title");
  });
});
