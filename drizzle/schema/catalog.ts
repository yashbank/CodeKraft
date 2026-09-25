/**
 * Catalog (docs/05 §2 + featured_products/wishlists from §10/§11): categories, tags, product_tags,
 * slug_redirects, products (generated `search_vector`, FR-CAT-07), product_versions, product_faqs,
 * product_testimonials, product_media, product_blogs, featured_products, wishlists.
 *
 * Rules enforced outside this file (drizzle/custom, P2.4):
 *  - categories depth ≤ 2 → trigger `category_depth` on insert/update of `parent_id` (D-303, docs/05 §12)
 *  - `products.search_vector` calls `immutable_array_to_string(text[])`; the migration must create it
 *    BEFORE the products table (see the comment on `searchVector` for the SQL body).
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { media, mediaKind } from "./media";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

/** Tiptap JSON document (docs/06 §1.10 rich-text allow-list is applied before persisting). */
export interface TiptapDoc {
  type: "doc";
  content?: TiptapNode[];
}
export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

/** Bullet-style product copy: features, benefits, target audience, use cases. */
export interface ProductBullet {
  title: string;
  description?: string;
  icon?: string;
}

/** Public changelog entry set for a product version (D-313). */
export interface ChangelogJson {
  summary?: string;
  added?: string[];
  changed?: string[];
  fixed?: string[];
  breaking?: string[];
}

export const productStatus = pgEnum("product_status", [
  "draft",
  "pending_approval",
  "scheduled",
  "published",
  "unpublished",
  "archived",
]);

export const slugRedirectEntity = pgEnum("slug_redirect_entity", ["product", "case_study", "blog"]);

export const blogStatus = pgEnum("blog_status", ["draft", "published"]);

/** T-categories — two levels max (trigger `category_depth`, D-303). */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    position: integer("position").notNull().default(0),
    description: text("description"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("categories_parent_idx").on(t.parentId)],
);

/** T-tags */
export const tags = pgTable("tags", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** T-slug_redirects — 301s after slug changes (FR-SEO). */
export const slugRedirects = pgTable(
  "slug_redirects",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    entity: slugRedirectEntity("entity").notNull(),
    oldSlug: text("old_slug").notNull(),
    newSlug: text("new_slug").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [unique("slug_redirects_entity_old_slug_unique").on(t.entity, t.oldSlug)],
);

/** T-products */
export const products = pgTable(
  "products",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    shortDescription: text("short_description").notNull().default(""),
    descriptionJson: jsonb("description_json").$type<TiptapDoc>(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    status: productStatus("status").notNull().default("draft"),
    publishAt: ts("publish_at"),
    publishedAt: ts("published_at"),
    archivedAt: ts("archived_at"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isUnlisted: boolean("is_unlisted").notNull().default(false),
    isComingSoon: boolean("is_coming_soon").notNull().default(false),
    isRefundable: boolean("is_refundable").notNull().default(false),
    taxEnabled: boolean("tax_enabled").notNull().default(false),
    currentVersion: text("current_version"),
    features: jsonb("features").$type<ProductBullet[]>(),
    benefits: jsonb("benefits").$type<ProductBullet[]>(),
    targetAudience: jsonb("target_audience").$type<ProductBullet[]>(),
    useCases: jsonb("use_cases").$type<ProductBullet[]>(),
    industry: text("industry")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    techStack: text("tech_stack")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    requirementsJson: jsonb("requirements_json").$type<TiptapDoc>(),
    liveDemoUrl: text("live_demo_url"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ogImageMediaId: uuid("og_image_media_id").references(() => media.id, { onDelete: "set null" }),
    canonicalUrl: text("canonical_url"),
    /**
     * Denormalised copy of the product's tag names (`tags.name` via `product_tags`), refreshed by the
     * catalog service whenever `product_tags` changes. A generated column cannot read another table,
     * and FR-CAT-07 requires tags in the search vector, so this is the bridge.
     */
    tagNames: text("tag_names")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /**
     * FR-CAT-07: name (A), short_description + tags + tech_stack + industry (B), description text (C).
     * `array_to_string` is only STABLE, so the expression uses the IMMUTABLE wrapper the integrator
     * creates in the migration before this table:
     *
     *   CREATE FUNCTION immutable_array_to_string(text[]) RETURNS text
     *     LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
     *     AS $$ SELECT array_to_string($1, ' ') $$;
     */
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`setweight(to_tsvector('english', coalesce(name, '')), 'A') || setweight(to_tsvector('english', coalesce(short_description, '')), 'B') || setweight(to_tsvector('english', coalesce(immutable_array_to_string(tag_names), '')), 'B') || setweight(to_tsvector('english', coalesce(immutable_array_to_string(tech_stack), '')), 'B') || setweight(to_tsvector('english', coalesce(immutable_array_to_string(industry), '')), 'B') || setweight(to_tsvector('english', coalesce(description_json, '{}'::jsonb)), 'C')`,
    ),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("products_search_vector_idx").using("gin", t.searchVector),
    index("products_status_publish_at_idx").on(t.status, t.publishAt),
    index("products_category_idx").on(t.categoryId),
    index("products_og_image_media_idx").on(t.ogImageMediaId),
    index("products_created_by_idx").on(t.createdBy),
    index("products_updated_by_idx").on(t.updatedBy),
  ],
);

/** T-product_tags */
export const productTags = pgTable(
  "product_tags",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.tagId] }),
    index("product_tags_tag_idx").on(t.tagId),
  ],
);

/** T-product_versions — public changelog (D-313); version strings are unique per product (API-CAT-07). */
export const productVersions = pgTable(
  "product_versions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    changelogJson: jsonb("changelog_json").$type<ChangelogJson>(),
    releasedAt: ts("released_at").notNull().defaultNow(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("product_versions_product_version_unique").on(t.productId, t.version),
    index("product_versions_product_idx").on(t.productId),
  ],
);

/** T-product_faqs */
export const productFaqs = pgTable(
  "product_faqs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answerJson: jsonb("answer_json").$type<TiptapDoc>().notNull(),
    position: integer("position").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("product_faqs_product_idx").on(t.productId)],
);

/** T-product_testimonials (D-312) */
export const productTestimonials = pgTable(
  "product_testimonials",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    authorTitle: text("author_title"),
    company: text("company"),
    quote: text("quote").notNull(),
    avatarMediaId: uuid("avatar_media_id").references(() => media.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    published: boolean("published").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("product_testimonials_product_idx").on(t.productId)],
);

/** T-product_media — attachment of a media object (or an embed URL) to a product, with alt text (a11y). */
export const productMedia = pgTable(
  "product_media",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    kind: mediaKind("kind").notNull(),
    mediaId: uuid("media_id").references(() => media.id, { onDelete: "restrict" }),
    embedUrl: text("embed_url"),
    title: text("title"),
    alt: text("alt").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("product_media_product_idx").on(t.productId, t.kind, t.position),
    index("product_media_media_idx").on(t.mediaId),
  ],
);

/** T-product_blogs — one blog post per product (D-121, D-804). */
export const productBlogs = pgTable(
  "product_blogs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    productId: uuid("product_id")
      .notNull()
      .unique()
      .references(() => products.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    bodyJson: jsonb("body_json").$type<TiptapDoc>(),
    coverMediaId: uuid("cover_media_id").references(() => media.id, { onDelete: "set null" }),
    status: blogStatus("status").notNull().default("draft"),
    publishedAt: ts("published_at"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("product_blogs_status_published_at_idx").on(t.status, t.publishedAt),
    index("product_blogs_author_idx").on(t.authorId),
  ],
);

/** featured_products (docs/05 §10, API-CONT-02: ≤ 8 published products, ordered). */
export const featuredProducts = pgTable(
  "featured_products",
  {
    productId: uuid("product_id")
      .primaryKey()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("featured_products_position_idx").on(t.position)],
);

/** wishlists (docs/05 §11) */
export const wishlists = pgTable(
  "wishlists",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.productId] }),
    index("wishlists_product_idx").on(t.productId),
  ],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type ProductTag = typeof productTags.$inferSelect;
export type NewProductTag = typeof productTags.$inferInsert;
export type SlugRedirect = typeof slugRedirects.$inferSelect;
export type NewSlugRedirect = typeof slugRedirects.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVersion = typeof productVersions.$inferSelect;
export type NewProductVersion = typeof productVersions.$inferInsert;
export type ProductFaq = typeof productFaqs.$inferSelect;
export type NewProductFaq = typeof productFaqs.$inferInsert;
export type ProductTestimonial = typeof productTestimonials.$inferSelect;
export type NewProductTestimonial = typeof productTestimonials.$inferInsert;
export type ProductMedia = typeof productMedia.$inferSelect;
export type NewProductMedia = typeof productMedia.$inferInsert;
export type ProductBlog = typeof productBlogs.$inferSelect;
export type NewProductBlog = typeof productBlogs.$inferInsert;
export type FeaturedProduct = typeof featuredProducts.$inferSelect;
export type NewFeaturedProduct = typeof featuredProducts.$inferInsert;
export type Wishlist = typeof wishlists.$inferSelect;
export type NewWishlist = typeof wishlists.$inferInsert;
