/**
 * Content (docs/05 §10): landing_chapters, services, case_studies, testimonials, client_logos, faqs,
 * legal_pages, legal_page_versions (retained 7 years, FR-CONT-04 — never cascade-delete).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { products, type TiptapDoc } from "./catalog";
import { media } from "./media";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const landingChapterKey = pgEnum("landing_chapter_key", [
  "who",
  "build",
  "sell",
  "proof",
  "talk",
]);
export const testimonialContext = pgEnum("testimonial_context", ["site", "product"]);
export const faqScope = pgEnum("faq_scope", ["site", "chatbot", "product"]);
export const legalPageKey = pgEnum("legal_page_key", ["privacy", "terms", "refunds", "license"]);

/** API-CONT-01 `media` payload (D-801, D-802). */
export interface LandingChapterMedia {
  posterMediaId?: string;
  videoEmbedUrl?: string;
  sceneVariant?: string;
}

export interface CtaLink {
  label: string;
  href: string;
}

/** API-CONT-01 `cta` payload. */
export interface LandingChapterCta {
  primary: CtaLink;
  secondary?: CtaLink;
}

export interface GalleryItem {
  mediaId: string;
  alt: string;
  caption?: string;
}

export const landingChapters = pgTable(
  "landing_chapters",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    key: landingChapterKey("key").notNull().unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    bodyJson: jsonb("body_json").$type<TiptapDoc>(),
    media: jsonb("media").$type<LandingChapterMedia>(),
    cta: jsonb("cta").$type<LandingChapterCta>(),
    position: integer("position").notNull().default(0),
    published: boolean("published").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("landing_chapters_position_idx").on(t.published, t.position)],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary"),
    deliverables: jsonb("deliverables").$type<string[]>(),
    bodyJson: jsonb("body_json").$type<TiptapDoc>(),
    /** lucide icon name */
    icon: text("icon"),
    position: integer("position").notNull().default(0),
    published: boolean("published").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("services_position_idx").on(t.published, t.position)],
);

export const caseStudies = pgTable(
  "case_studies",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    clientName: text("client_name"),
    industry: text("industry"),
    problemJson: jsonb("problem_json").$type<TiptapDoc>(),
    solutionJson: jsonb("solution_json").$type<TiptapDoc>(),
    resultsJson: jsonb("results_json").$type<TiptapDoc>(),
    techStack: text("tech_stack")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    coverMediaId: uuid("cover_media_id").references(() => media.id, { onDelete: "set null" }),
    gallery: jsonb("gallery").$type<GalleryItem[]>(),
    published: boolean("published").notNull().default(false),
    publishedAt: ts("published_at"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("case_studies_published_idx").on(t.published, t.publishedAt)],
);

/** Site-wide testimonials; product-scoped quotes also exist as T-product_testimonials (D-312). */
export const testimonials = pgTable(
  "testimonials",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    quote: text("quote").notNull(),
    authorName: text("author_name").notNull(),
    authorTitle: text("author_title"),
    company: text("company"),
    avatarMediaId: uuid("avatar_media_id").references(() => media.id, { onDelete: "set null" }),
    context: testimonialContext("context").notNull().default("site"),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    published: boolean("published").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("testimonials_context_idx").on(t.context, t.published, t.position),
    index("testimonials_product_idx").on(t.productId),
  ],
);

export const clientLogos = pgTable(
  "client_logos",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    url: text("url"),
    position: integer("position").notNull().default(0),
    published: boolean("published").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("client_logos_media_idx").on(t.mediaId)],
);

export const faqs = pgTable(
  "faqs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    question: text("question").notNull(),
    answerJson: jsonb("answer_json").$type<TiptapDoc>().notNull(),
    scope: faqScope("scope").notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    published: boolean("published").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("faqs_scope_idx").on(t.scope, t.published, t.position),
    index("faqs_product_idx").on(t.productId),
  ],
);

/** Current text of each legal page; every publish also snapshots into legal_page_versions. */
export const legalPages = pgTable("legal_pages", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  key: legalPageKey("key").notNull().unique(),
  title: text("title").notNull(),
  bodyJson: jsonb("body_json").$type<TiptapDoc>().notNull(),
  version: integer("version").notNull().default(1),
  publishedAt: ts("published_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Immutable history of published legal texts, retained 7 years (FR-CONT-04). */
export const legalPageVersions = pgTable(
  "legal_page_versions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    legalPageId: uuid("legal_page_id")
      .notNull()
      .references(() => legalPages.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    bodyJson: jsonb("body_json").$type<TiptapDoc>().notNull(),
    publishedAt: ts("published_at").notNull().defaultNow(),
    publishedBy: uuid("published_by")
      .notNull()
      .references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("legal_page_versions_page_version_unique").on(t.legalPageId, t.version),
    index("legal_page_versions_published_by_idx").on(t.publishedBy),
  ],
);

export type LandingChapter = typeof landingChapters.$inferSelect;
export type NewLandingChapter = typeof landingChapters.$inferInsert;
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type CaseStudy = typeof caseStudies.$inferSelect;
export type NewCaseStudy = typeof caseStudies.$inferInsert;
export type Testimonial = typeof testimonials.$inferSelect;
export type NewTestimonial = typeof testimonials.$inferInsert;
export type ClientLogo = typeof clientLogos.$inferSelect;
export type NewClientLogo = typeof clientLogos.$inferInsert;
export type Faq = typeof faqs.$inferSelect;
export type NewFaq = typeof faqs.$inferInsert;
export type LegalPage = typeof legalPages.$inferSelect;
export type NewLegalPage = typeof legalPages.$inferInsert;
export type LegalPageVersion = typeof legalPageVersions.$inferSelect;
export type NewLegalPageVersion = typeof legalPageVersions.$inferInsert;
