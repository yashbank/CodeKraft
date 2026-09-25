/**
 * Blog contracts — docs/06 API-CAT-10 (`upsertProductBlog` / `publishProductBlog` /
 * `unpublishProductBlog`), API-CAT-33 (`listBlogPosts` / `getBlogBySlug`), API-CAT-34
 * (`listBlogTeasers`). Blog publish is not a BR-13 approval action; the product must be `published`.
 */
import { z } from "zod";
import type { Context, RequestContext } from "@/lib/authz/context";
import type { DbOrTx } from "@/lib/db";
import {
  type ListResult,
  currencySchema,
  listParams,
  richTextSchema,
  slugSchema,
  text,
  uuidSchema,
} from "../catalog/contracts";
import type { BlogCard, BlogDetail, ProductBlog } from "./types";

/** API-CAT-10 `upsertProductBlog` (one per product; a slug change on a published blog writes `slug_redirects`). */
export const upsertProductBlogSchema = z.strictObject({
  productId: uuidSchema,
  slug: slugSchema,
  title: text(160),
  excerpt: text(300),
  bodyJson: richTextSchema,
  coverMediaId: uuidSchema.optional(),
  seoTitle: text(70).optional(),
  seoDescription: text(160).optional(),
});
export type UpsertProductBlogInput = z.infer<typeof upsertProductBlogSchema>;

/** API-CAT-10 `publishProductBlog` / `unpublishProductBlog` (`content.publish`). */
export const blogPublishSchema = z.strictObject({ productId: uuidSchema });

/** API-CAT-33 `listBlogPosts` — published only, 60 s ISR. */
export const listBlogPostsSchema = listParams(
  ["publishedAt"],
  z.strictObject({ productSlug: slugSchema.optional() }),
);
export type ListBlogPostsInput = z.infer<typeof listBlogPostsSchema>;

/** API-CAT-33 `getBlogBySlug`. */
export const getBlogBySlugSchema = z.strictObject({
  slug: slugSchema,
  displayCurrency: currencySchema,
});

/** API-CAT-34 `listBlogTeasers` (landing). */
export const listBlogTeasersSchema = z.strictObject({
  limit: z.number().int().min(1).max(12).default(3),
});

export const BLOG_CACHE_TAGS = {
  upsertProductBlog: ["blog", "sitemap"],
  publishProductBlog: ["blog", "sitemap"],
  unpublishProductBlog: ["blog", "sitemap"],
} as const satisfies Record<string, readonly string[]>;

export interface BlogService {
  /** API-CAT-10 (`catalog.write`). */
  upsertProductBlog(
    ctx: RequestContext,
    input: UpsertProductBlogInput,
    tx?: DbOrTx,
  ): Promise<{ blog: ProductBlog }>;
  /** API-CAT-10 (`content.publish`; `STATE_INVALID` unless the product is `published`). */
  publishProductBlog(
    ctx: RequestContext,
    input: z.infer<typeof blogPublishSchema>,
    tx?: DbOrTx,
  ): Promise<{ blog: ProductBlog }>;
  /** API-CAT-10 (`content.publish`). */
  unpublishProductBlog(
    ctx: RequestContext,
    input: z.infer<typeof blogPublishSchema>,
    tx?: DbOrTx,
  ): Promise<{ blog: ProductBlog }>;
  /** API-CAT-33 (public query). */
  listBlogPosts(
    ctx: Context,
    input: ListBlogPostsInput,
    tx?: DbOrTx,
  ): Promise<ListResult<BlogCard>>;
  /** API-CAT-33 (public query; JSON-LD `Article`). */
  getBlogBySlug(
    ctx: Context,
    input: z.infer<typeof getBlogBySlugSchema>,
    tx?: DbOrTx,
  ): Promise<BlogDetail>;
  /** API-CAT-34 (landing). */
  listBlogTeasers(
    ctx: Context,
    input: z.infer<typeof listBlogTeasersSchema>,
    tx?: DbOrTx,
  ): Promise<BlogCard[]>;
}
