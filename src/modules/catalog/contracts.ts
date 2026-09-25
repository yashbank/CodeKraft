/**
 * Catalog contracts — docs/06 §2.2 API-CAT-01/02/07/08/09/11–15/18/19/20/31/32/34/35/36,
 * docs/06 §1.3 (validation), §1.8 (lists), §1.10 (cache tags), P2.5 contracts A.
 *
 * Zod input schemas are `strictObject` (unknown keys → `VALIDATION`, PHASE-02 P2.5) and are the
 * schemas the Server Actions parse first (docs/06 §1.3) and react-hook-form reuses. No runtime
 * behaviour lives here; `service.ts` / `actions.ts` / `queries.ts` are P3.
 *
 * The shared primitives (`slugSchema`, `moneySchema`, `bpsSchema`, `uuidSchema`,
 * `richTextSchema`, `listParams`) are the docs/06 §1.3 rules; since P2.8 they live in
 * `src/modules/_shared/zod.ts` and are re-exported here under their P2.5 names.
 */
import { z } from "zod";
import {
  currencySchema,
  isoDateTimeSchema,
  listParams,
  richTextSchema,
  slugSchema,
  trimmedString,
  uuidSchema,
  type ListResult,
} from "@/modules/_shared/zod";
import type { Context, RequestContext } from "@/lib/authz/context";
import type { DbOrTx, TxCtx } from "@/lib/db";
import {
  type Category,
  type CategoryNode,
  type LifecyclePayload,
  PRODUCT_STATUSES,
  type Product,
  type ProductAdminGraph,
  type ProductAdminRow,
  type ProductCard,
  type ProductDetail,
  type ProductFaqView,
  type ProductStatus,
  type ProductTestimonialView,
  type ProductVersionView,
  type PublishPayload,
  type Tag,
} from "./types";

/* ========================================================================================== */
/* Shared primitives — canonical set in `src/modules/_shared/zod.ts` (P2.8); re-exported here  */
/* under the P2.5 names so the domain-A public surface is unchanged.                           */
/* ========================================================================================== */

export {
  LIST_LIMIT_DEFAULT,
  LIST_LIMIT_MAX,
  RICH_TEXT_MARK_TYPES,
  RICH_TEXT_MAX_DEPTH,
  RICH_TEXT_NODE_TYPES,
  SLUG_PATTERN,
  bpsSchema,
  currencySchema,
  cursorSchema,
  isoDateSchema,
  isoDateTimeSchema,
  limitSchema,
  listParams,
  moneySchema,
  richTextNodeSchema,
  richTextSchema,
  slugSchema,
  uuidSchema,
  type ListResult,
  type RichTextDoc,
  type RichTextNode,
  type SortKey,
} from "@/modules/_shared/zod";

export const positionSchema = z.number().int().min(0).max(10_000);
/** Trimmed, bounded free text (`text(max, min = 1)`), the domain-A spelling of `trimmedString`. */
export const text = (max: number, min = 1) => trimmedString(min, max);
export const httpUrlSchema = z.url({ protocol: /^https?$/ }).max(2048);
/** `major.minor.patch[-prerelease][+build]` (API-CAT-07). */
export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
export const semverSchema = z.string().trim().max(64).regex(SEMVER_PATTERN, "semver expected");

/* ========================================================================================== */
/* Catalog inputs                                                                              */
/* ========================================================================================== */

export const productBulletSchema = z.strictObject({
  title: text(120),
  description: text(500).optional(),
  /** lucide icon name */
  icon: text(64).optional(),
});
export const productBulletsSchema = z.array(productBulletSchema).max(24);
const tagNamesSchema = z.array(text(40)).max(20);
const stringListSchema = z.array(text(60)).max(30);
const seoTitleSchema = text(70);
const seoDescriptionSchema = text(160);

/** API-CAT-01 `createProduct`. */
export const createProductSchema = z.strictObject({
  name: text(120),
  slug: slugSchema,
  shortDescription: text(300),
  categoryId: uuidSchema.optional(),
  tags: tagNamesSchema.optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;
export interface CreateProductResult {
  productId: string;
  status: "draft";
}

/** API-CAT-02 `updateProduct` patch fields (all optional; `null` clears nullable columns). */
export const productPatchSchema = z
  .strictObject({
    name: text(120),
    slug: slugSchema,
    shortDescription: text(300),
    descriptionJson: richTextSchema.nullable(),
    categoryId: uuidSchema.nullable(),
    tags: tagNamesSchema,
    isFeatured: z.boolean(),
    isUnlisted: z.boolean(),
    isComingSoon: z.boolean(),
    isRefundable: z.boolean(),
    taxEnabled: z.boolean(),
    currentVersion: semverSchema.nullable(),
    features: productBulletsSchema,
    benefits: productBulletsSchema,
    targetAudience: productBulletsSchema,
    useCases: productBulletsSchema,
    industry: stringListSchema,
    techStack: stringListSchema,
    requirementsJson: richTextSchema.nullable(),
    liveDemoUrl: httpUrlSchema.nullable(),
    seoTitle: seoTitleSchema.nullable(),
    seoDescription: seoDescriptionSchema.nullable(),
    ogImageMediaId: uuidSchema.nullable(),
    canonicalUrl: httpUrlSchema.nullable(),
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, "patch must change at least one field");

/** API-CAT-02 `updateProduct` — optimistic concurrency via `expectedUpdatedAt`. */
export const updateProductSchema = z.strictObject({
  productId: uuidSchema,
  expectedUpdatedAt: isoDateTimeSchema,
  patch: productPatchSchema,
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const changelogSchema = z.strictObject({
  summary: text(500).optional(),
  added: z.array(text(300)).max(50).optional(),
  changed: z.array(text(300)).max(50).optional(),
  fixed: z.array(text(300)).max(50).optional(),
  breaking: z.array(text(300)).max(50).optional(),
});

/** API-CAT-07 `createProductVersion`. */
export const createProductVersionSchema = z.strictObject({
  productId: uuidSchema,
  version: semverSchema,
  changelogJson: changelogSchema,
  releaseFile: z.strictObject({ mediaId: uuidSchema, notes: text(1000, 0).optional() }).optional(),
});
export type CreateProductVersionInput = z.infer<typeof createProductVersionSchema>;

/** API-CAT-08 `upsertProductFaq`. */
export const upsertProductFaqSchema = z.strictObject({
  productId: uuidSchema,
  faqId: uuidSchema.optional(),
  question: text(300),
  answerJson: richTextSchema,
  position: positionSchema,
});
export type UpsertProductFaqInput = z.infer<typeof upsertProductFaqSchema>;
/** API-CAT-08 `deleteProductFaq`. */
export const deleteProductFaqSchema = z.strictObject({ productId: uuidSchema, faqId: uuidSchema });
/** API-CAT-08 `reorderProductFaqs` — full ordered id list. */
export const reorderProductFaqsSchema = z.strictObject({
  productId: uuidSchema,
  faqIds: z.array(uuidSchema).min(1).max(200),
});

/** API-CAT-09 `upsertProductTestimonial`. */
export const upsertProductTestimonialSchema = z.strictObject({
  productId: uuidSchema,
  id: uuidSchema.optional(),
  authorName: text(120),
  authorTitle: text(120).optional(),
  company: text(120).optional(),
  quote: text(1000),
  avatarMediaId: uuidSchema.optional(),
  position: positionSchema,
  published: z.boolean(),
});
export type UpsertProductTestimonialInput = z.infer<typeof upsertProductTestimonialSchema>;
/** API-CAT-09 `deleteProductTestimonial`. */
export const deleteProductTestimonialSchema = z.strictObject({
  productId: uuidSchema,
  id: uuidSchema,
});

/** API-CAT-11 `submitForApproval`. */
export const submitForApprovalSchema = z.strictObject({
  productId: uuidSchema,
  publishAt: isoDateTimeSchema.optional(),
});
export type SubmitForApprovalInput = z.infer<typeof submitForApprovalSchema>;

/** API-CAT-12 approval payload (`product.publish`) validated before apply. */
export const publishPayloadSchema = z.strictObject({
  productId: uuidSchema,
  publishAt: isoDateTimeSchema.optional(),
}) satisfies z.ZodType<PublishPayload>;

/** API-CAT-13 `unpublishProduct`. */
export const unpublishProductSchema = z.strictObject({
  productId: uuidSchema,
  reason: text(500),
});
/** API-CAT-14 `requestArchive` / `requestDelete`. */
export const lifecycleRequestSchema = z.strictObject({
  productId: uuidSchema,
  reason: text(500),
});
export type LifecycleRequestInput = z.infer<typeof lifecycleRequestSchema>;
/** API-CAT-15 approval payload (`product.archive` / `product.delete`). */
export const lifecyclePayloadSchema = lifecycleRequestSchema satisfies z.ZodType<LifecyclePayload>;

/** API-CAT-18 `listProductsAdmin`. */
export const listProductsAdminSchema = listParams(
  ["updatedAt", "name", "status"],
  z.strictObject({
    status: z.enum(PRODUCT_STATUSES).optional(),
    categoryId: uuidSchema.optional(),
    partnerId: uuidSchema.optional(),
    search: z.string().trim().max(200).optional(),
  }),
);
export type ListProductsAdminInput = z.infer<typeof listProductsAdminSchema>;

/** API-CAT-19 `getProductAdmin`. */
export const getProductAdminSchema = z.strictObject({ productId: uuidSchema });

/** API-CAT-20 `upsertCategory` (depth ≤ 2 is a DB trigger, D-303). */
export const upsertCategorySchema = z.strictObject({
  id: uuidSchema.optional(),
  parentId: uuidSchema.nullable().optional(),
  name: text(80),
  slug: slugSchema,
  position: positionSchema,
  description: text(500).optional(),
});
export type UpsertCategoryInput = z.infer<typeof upsertCategorySchema>;
/** API-CAT-20 `deleteCategory`. */
export const deleteCategorySchema = z.strictObject({ categoryId: uuidSchema });
/** API-CAT-20 `upsertTag`. */
export const upsertTagSchema = z.strictObject({
  id: uuidSchema.optional(),
  name: text(40),
  slug: slugSchema,
});

/** API-CAT-31 `getProductBySlug`. */
export const getProductBySlugSchema = z.strictObject({
  slug: slugSchema,
  displayCurrency: currencySchema,
});
export type GetProductBySlugInput = z.infer<typeof getProductBySlugSchema>;

/** API-CAT-34 `listFeaturedProducts` (≤ 8, API-CONT-02). */
export const listFeaturedProductsSchema = z.strictObject({
  limit: z.number().int().min(1).max(8).default(8),
  displayCurrency: currencySchema,
});

/** API-CAT-35 `toggleWishlist`. */
export const toggleWishlistSchema = z.strictObject({ productId: uuidSchema, on: z.boolean() });
export type ToggleWishlistInput = z.infer<typeof toggleWishlistSchema>;

/** API-CAT-36 `listMyWishlist`. */
export const listMyWishlistSchema = listParams(["createdAt"]).extend({
  displayCurrency: currencySchema,
});

/* ========================================================================================== */
/* Cache tags (docs/06 §1.10) each mutation revalidates                                        */
/* ========================================================================================== */

export const CACHE_TAGS = {
  catalog: "catalog",
  product: (slug: string) => `product:${slug}` as const,
  blog: "blog",
  blogPost: (slug: string) => `blog:${slug}` as const,
  content: "content",
  caseStudies: "case-studies",
  caseStudy: (slug: string) => `case-study:${slug}` as const,
  settings: "settings",
  sitemap: "sitemap",
} as const;

/** Tags per catalog mutation (`product:<slug>` implied wherever a product is touched). */
export const CATALOG_CACHE_TAGS = {
  updateProduct: ["catalog", "sitemap"],
  applyPublish: ["catalog", "sitemap"],
  unpublishProduct: ["catalog", "sitemap"],
  applyArchive: ["catalog", "sitemap"],
  applyDelete: ["catalog", "sitemap"],
  upsertCategory: ["catalog"],
  deleteCategory: ["catalog"],
  upsertTag: ["catalog"],
} as const satisfies Record<string, readonly string[]>;

/* ========================================================================================== */
/* Service                                                                                    */
/* ========================================================================================== */

/** Method set of `modules/catalog/service.ts` (P3). Internal `apply*` run inside `approvals.execute`. */
export interface CatalogService {
  /** API-CAT-01 */
  createProduct(
    ctx: RequestContext,
    input: CreateProductInput,
    tx?: DbOrTx,
  ): Promise<CreateProductResult>;
  /** API-CAT-02 */
  updateProduct(
    ctx: RequestContext,
    input: UpdateProductInput,
    tx?: DbOrTx,
  ): Promise<{ product: Product }>;
  /** API-CAT-07 */
  createProductVersion(
    ctx: RequestContext,
    input: CreateProductVersionInput,
    tx?: DbOrTx,
  ): Promise<{ version: ProductVersionView }>;
  /** API-CAT-08 */
  upsertProductFaq(
    ctx: RequestContext,
    input: UpsertProductFaqInput,
    tx?: DbOrTx,
  ): Promise<{ faqs: ProductFaqView[] }>;
  /** API-CAT-08 */
  deleteProductFaq(
    ctx: RequestContext,
    input: z.infer<typeof deleteProductFaqSchema>,
    tx?: DbOrTx,
  ): Promise<{ faqs: ProductFaqView[] }>;
  /** API-CAT-08 */
  reorderProductFaqs(
    ctx: RequestContext,
    input: z.infer<typeof reorderProductFaqsSchema>,
    tx?: DbOrTx,
  ): Promise<{ faqs: ProductFaqView[] }>;
  /** API-CAT-09 */
  upsertProductTestimonial(
    ctx: RequestContext,
    input: UpsertProductTestimonialInput,
    tx?: DbOrTx,
  ): Promise<{ testimonials: ProductTestimonialView[] }>;
  /** API-CAT-09 */
  deleteProductTestimonial(
    ctx: RequestContext,
    input: z.infer<typeof deleteProductTestimonialSchema>,
    tx?: DbOrTx,
  ): Promise<{ testimonials: ProductTestimonialView[] }>;
  /** API-CAT-11 — readiness checks then `approvals.request('product.publish', …)`. */
  submitForApproval(
    ctx: RequestContext,
    input: SubmitForApprovalInput,
    tx?: DbOrTx,
  ): Promise<{ approvalRequestId: string }>;
  /** API-CAT-12 (internal apply handler registered with approvals, `registerApplyHandler('product.publish', …)`). */
  applyPublish(payload: PublishPayload, tx: TxCtx): Promise<void>;
  /** API-ADM-03 reject handler for `product.publish`: product back to `draft`. */
  onPublishRejected(payload: PublishPayload, tx: TxCtx): Promise<void>;
  /** API-CAT-13 */
  unpublishProduct(
    ctx: RequestContext,
    input: z.infer<typeof unpublishProductSchema>,
    tx?: DbOrTx,
  ): Promise<{ product: Product }>;
  /** API-CAT-14 (`product.archive`). */
  requestArchive(
    ctx: RequestContext,
    input: LifecycleRequestInput,
    tx?: DbOrTx,
  ): Promise<{ approvalRequestId: string }>;
  /** API-CAT-14 (`product.delete`; refused up front when `order_items` exist, BR-11). */
  requestDelete(
    ctx: RequestContext,
    input: LifecycleRequestInput,
    tx?: DbOrTx,
  ): Promise<{ approvalRequestId: string }>;
  /** API-CAT-15 (internal apply handler for `product.archive`). */
  applyArchive(payload: LifecyclePayload, tx: TxCtx): Promise<void>;
  /** API-CAT-15 (internal apply handler for `product.delete`; re-checks zero orders inside `tx`). */
  applyDelete(payload: LifecyclePayload, tx: TxCtx): Promise<void>;
  /** API-CAT-18 (query, D-512 `own_products` scope for partners). */
  listProductsAdmin(
    ctx: RequestContext,
    input: ListProductsAdminInput,
    tx?: DbOrTx,
  ): Promise<ListResult<ProductAdminRow>>;
  /** API-CAT-19 (query). */
  getProductAdmin(
    ctx: RequestContext,
    input: z.infer<typeof getProductAdminSchema>,
    tx?: DbOrTx,
  ): Promise<ProductAdminGraph>;
  /** API-CAT-20 */
  upsertCategory(
    ctx: RequestContext,
    input: UpsertCategoryInput,
    tx?: DbOrTx,
  ): Promise<{ category: Category }>;
  /** API-CAT-20 */
  deleteCategory(
    ctx: RequestContext,
    input: z.infer<typeof deleteCategorySchema>,
    tx?: DbOrTx,
  ): Promise<void>;
  /** API-CAT-20 */
  upsertTag(
    ctx: RequestContext,
    input: z.infer<typeof upsertTagSchema>,
    tx?: DbOrTx,
  ): Promise<{ tag: Tag }>;
  /** API-CAT-31 (public query; `unpublished` visible only to entitlement holders). */
  getProductBySlug(ctx: Context, input: GetProductBySlugInput, tx?: DbOrTx): Promise<ProductDetail>;
  /** API-CAT-32 `listCategories` (public query, tree with counts). */
  listCategories(ctx: Context, tx?: DbOrTx): Promise<CategoryNode[]>;
  /** API-CAT-34 `listFeaturedProducts` (landing, `featured_products` order). */
  listFeaturedProducts(
    ctx: Context,
    input: z.infer<typeof listFeaturedProductsSchema>,
    tx?: DbOrTx,
  ): Promise<ProductCard[]>;
  /** API-CAT-35 */
  toggleWishlist(
    ctx: RequestContext,
    input: ToggleWishlistInput,
    tx?: DbOrTx,
  ): Promise<{ wishlisted: boolean }>;
  /** API-CAT-36 (query). */
  listMyWishlist(
    ctx: RequestContext,
    input: z.infer<typeof listMyWishlistSchema>,
    tx?: DbOrTx,
  ): Promise<ListResult<ProductCard>>;
  /** Internal: refresh `products.tag_names` after `product_tags` changes (FR-CAT-07 search bridge). */
  refreshTagNames(productId: string, tx: TxCtx): Promise<void>;
}

/** Statuses from which `submitForApproval` is allowed (API-CAT-11). */
export const SUBMITTABLE_STATUSES: readonly ProductStatus[] = ["draft", "unpublished"];
