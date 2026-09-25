/**
 * Catalog domain types — docs/05 §2, docs/06 §2.2 (API-CAT-*), P2.5 contracts A.
 *
 * Row types are re-exported from the Drizzle schema (`$inferSelect`); view models are the shapes
 * the docs/06 rows return. Enum tuples mirror the pgEnums so the Zod contracts never import
 * `drizzle-orm/pg-core` (the schemas are reused by react-hook-form on the client, docs/06 §1.3).
 */
import type {
  productStatus,
  slugRedirectEntity,
  ChangelogJson,
  Product,
  ProductBlog,
  ProductBullet,
  TiptapDoc,
  TiptapNode,
} from "../../../drizzle/schema/catalog";
import type { Money } from "@/lib/money";
import type { DeliveryTypeValue, OfferingView, PurchaseModelValue } from "../offerings/types";
import type { ProductMediaView } from "../media/types";
import type { BlogTeaser } from "../blog/types";
import type { OwnershipSummary, OwnershipVersionView } from "../ownership/types";

export type {
  Category,
  FeaturedProduct,
  Product,
  ProductFaq,
  ProductMedia,
  ProductTestimonial,
  ProductVersion,
  SlugRedirect,
  Tag,
  Wishlist,
} from "../../../drizzle/schema/catalog";
export type { ChangelogJson, ProductBullet, TiptapDoc, TiptapNode };

/* ------------------------------------------------------------------------------------------ */
/* Enum mirrors                                                                                */
/* ------------------------------------------------------------------------------------------ */

/**
 * Build a const tuple that must equal a pgEnum's value set in both directions. `E` is the
 * enum's union (from `typeof pgEnum.enumValues`); a missing or extra literal is a type error.
 */
export function enumTuple<E extends string>() {
  return <T extends readonly E[]>(values: T & (E extends T[number] ? unknown : never)): T => values;
}

export type ProductStatus = (typeof productStatus.enumValues)[number];
export const PRODUCT_STATUSES = enumTuple<ProductStatus>()([
  "draft",
  "pending_approval",
  "scheduled",
  "published",
  "unpublished",
  "archived",
] as const);

export type SlugRedirectEntity = (typeof slugRedirectEntity.enumValues)[number];
export const SLUG_REDIRECT_ENTITIES = enumTuple<SlugRedirectEntity>()([
  "product",
  "case_study",
  "blog",
] as const);

/** Approval types raised by the catalog (subset of `approval_type`, domain B). */
export type CatalogApprovalType = "product.publish" | "product.archive" | "product.delete";

/* ------------------------------------------------------------------------------------------ */
/* Approval payloads (API-CAT-11/12, 14/15)                                                    */
/* ------------------------------------------------------------------------------------------ */

/** `approval_requests.payload` for `product.publish` (API-CAT-11 → API-CAT-12). */
export interface PublishPayload {
  productId: string;
  /** ISO-8601 UTC; absent = publish immediately. */
  publishAt?: string;
}

/** `approval_requests.payload` for `product.archive` / `product.delete` (API-CAT-14 → 15). */
export interface LifecyclePayload {
  productId: string;
  reason: string;
}

/* ------------------------------------------------------------------------------------------ */
/* View models                                                                                 */
/* ------------------------------------------------------------------------------------------ */

export interface ImageRef {
  mediaId: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  blurHash: string | null;
}

export interface CategoryRef {
  id: string;
  slug: string;
  name: string;
}

export interface TagRef {
  id: string;
  slug: string;
  name: string;
}

/** API-CAT-30/34/36 `ProductCard` — prices already in the display currency. */
export interface ProductCard {
  slug: string;
  name: string;
  shortDescription: string;
  coverImage: ImageRef | null;
  category: CategoryRef | null;
  tags: TagRef[];
  fromPrice: Money | null;
  compareAtPrice?: Money;
  purchaseModels: PurchaseModelValue[];
  deliveryTypes: DeliveryTypeValue[];
  isFeatured: boolean;
  isComingSoon: boolean;
  currentVersion: string | null;
}

export interface Breadcrumb {
  label: string;
  href: string;
}

export interface ProductVersionView {
  version: string;
  changelog: ChangelogJson | null;
  releasedAt: string;
}

export interface ProductFaqView {
  id: string;
  question: string;
  answer: TiptapDoc;
  position: number;
}

export interface ProductTestimonialView {
  id: string;
  authorName: string;
  authorTitle: string | null;
  company: string | null;
  quote: string;
  avatar: ImageRef | null;
}

/** API-CAT-31 `ProductDetail` — never carries ownership (BR-02). */
export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: TiptapDoc | null;
  status: ProductStatus;
  category: CategoryRef | null;
  tags: TagRef[];
  isFeatured: boolean;
  isUnlisted: boolean;
  isComingSoon: boolean;
  isRefundable: boolean;
  taxEnabled: boolean;
  currentVersion: string | null;
  features: ProductBullet[];
  benefits: ProductBullet[];
  targetAudience: ProductBullet[];
  useCases: ProductBullet[];
  industry: string[];
  techStack: string[];
  requirements: TiptapDoc | null;
  liveDemoUrl: string | null;
  media: ProductMediaView[];
  offerings: OfferingView[];
  faqs: ProductFaqView[];
  testimonials: ProductTestimonialView[];
  versions: ProductVersionView[];
  blogTeaser: BlogTeaser | null;
  seo: {
    title: string;
    description: string;
    canonicalUrl: string | null;
    ogImage: ImageRef | null;
  };
  jsonLd: Record<string, unknown>;
  breadcrumbs: Breadcrumb[];
}

/** API-CAT-18 row. */
export interface ProductAdminRow {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  category: CategoryRef | null;
  isFeatured: boolean;
  isUnlisted: boolean;
  publishAt: string | null;
  updatedAt: string;
  updatedBy: { id: string; name: string };
  /** Active (or pending) ownership summary — admin only. */
  ownership: OwnershipSummary | null;
  offeringCount: number;
  orderCount: number;
}

/** API-CAT-19 full graph. */
export interface ProductAdminGraph {
  product: Product;
  tags: TagRef[];
  offerings: OfferingView[];
  media: ProductMediaView[];
  versions: ProductVersionView[];
  faqs: ProductFaqView[];
  testimonials: (ProductTestimonialView & { position: number; published: boolean })[];
  blog: ProductBlog | null;
  ownershipVersions: OwnershipVersionView[];
  approval: { requestId: string; type: CatalogApprovalType; status: string } | null;
  orderCount: number;
}

export interface CategoryNode extends CategoryRef {
  parentId: string | null;
  position: number;
  description: string | null;
  productCount: number;
  children: CategoryNode[];
}
