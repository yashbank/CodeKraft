/**
 * Catalog factories (docs/05 §2): categories (depth ≤ 2, trigger `category_depth`), products
 * (optionally with an active ownership version), media objects.
 */
import { eq } from "drizzle-orm";

import {
  type Category,
  categories,
  type NewProduct,
  type Product,
  type ProductBullet,
  products,
  type TiptapDoc,
} from "../../drizzle/schema/catalog";
import { type Media, media } from "../../drizzle/schema/media";
import { type FactoryDb, nextSeq, one, seqLabel, toFactoryDb } from "./context";
import {
  createOwnership,
  type OwnershipLineInput,
  type OwnershipWithLines,
  type OwnershipStatus,
} from "./ownership";
import { createAdmin } from "./users";

export type ProductStatus = Product["status"];

export interface CreateCategoryOptions {
  name?: string;
  slug?: string;
  parentId?: string | null;
  position?: number;
  description?: string | null;
}

export async function createCategory(
  opts: CreateCategoryOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<Category> {
  const label = seqLabel("category");
  return one(
    await db
      .insert(categories)
      .values({
        name: opts.name ?? label,
        slug: opts.slug ?? label,
        parentId: opts.parentId ?? null,
        position: opts.position ?? 0,
        description: opts.description ?? null,
      })
      .returning(),
    "categories",
  );
}

/** Plain paragraph doc for description/requirements columns. */
export function tiptapParagraph(text: string): TiptapDoc {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

export interface CreateProductOwnershipInput {
  companyCutBps?: number;
  /** Default: one new partner at 10 000 bps. */
  lines?: readonly OwnershipLineInput[];
  status?: OwnershipStatus;
}

export interface CreateProductOptions {
  name?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  status?: ProductStatus;
  categoryId?: string | null;
  isFeatured?: boolean;
  isUnlisted?: boolean;
  isRefundable?: boolean;
  taxEnabled?: boolean;
  techStack?: string[];
  industry?: string[];
  features?: ProductBullet[];
  currentVersion?: string | null;
  /** Default: a new admin user (also `updated_by`). */
  createdBy?: string;
  /** When given, an ownership version (default `active`) with these lines is created. */
  ownership?: CreateProductOwnershipInput;
  /** Escape hatch for any other column. */
  overrides?: Partial<NewProduct>;
}

export type ProductWithOwnership = Product & { ownership: OwnershipWithLines | null };

export async function createProduct(
  opts: CreateProductOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<ProductWithOwnership> {
  const label = seqLabel("product");
  const status = opts.status ?? "published";
  const createdBy = opts.createdBy ?? (await createAdmin({}, db)).id;
  const now = new Date();
  const product = one(
    await db
      .insert(products)
      .values({
        name: opts.name ?? `Product ${label.slice(-4)}`,
        slug: opts.slug ?? label,
        shortDescription: opts.shortDescription ?? `Short description for ${label}`,
        descriptionJson: tiptapParagraph(opts.description ?? `Long description for ${label}.`),
        status,
        publishedAt: status === "published" ? now : null,
        publishAt: status === "scheduled" ? new Date(now.getTime() + 86_400_000) : null,
        archivedAt: status === "archived" ? now : null,
        categoryId: opts.categoryId ?? null,
        isFeatured: opts.isFeatured ?? false,
        isUnlisted: opts.isUnlisted ?? false,
        isRefundable: opts.isRefundable ?? false,
        taxEnabled: opts.taxEnabled ?? false,
        techStack: opts.techStack ?? ["Next.js", "Postgres"],
        industry: opts.industry ?? ["SaaS"],
        features: opts.features ?? [{ title: "Feature one" }, { title: "Feature two" }],
        currentVersion: opts.currentVersion ?? "1.0.0",
        createdBy,
        updatedBy: createdBy,
        ...opts.overrides,
      })
      .returning(),
    "products",
  );

  let ownership: OwnershipWithLines | null = null;
  if (opts.ownership !== undefined) {
    ownership = await createOwnership(
      {
        productId: product.id,
        companyCutBps: opts.ownership.companyCutBps,
        lines: opts.ownership.lines,
        status: opts.ownership.status,
        createdBy,
      },
      db,
    );
  }
  return { ...product, ownership };
}

/** Find a product by slug (tests reference seed products by slug, never by id — docs/10 §3). */
export async function findProductBySlug(slug: string, db: FactoryDb = toFactoryDb()) {
  const [row] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return row ?? null;
}

export interface CreateMediaOptions {
  /** Default: a new admin user. */
  uploadedBy?: string;
  bucket?: string;
  objectKey?: string;
  mime?: string;
  sizeBytes?: number;
  width?: number | null;
  height?: number | null;
  visibility?: Media["visibility"];
  checksum?: string;
}

/** A stored-object row (no bytes are uploaded; the key points at a placeholder). */
export async function createMedia(
  opts: CreateMediaOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<Media> {
  const uploadedBy = opts.uploadedBy ?? (await createAdmin({}, db)).id;
  const n = nextSeq();
  const visibility = opts.visibility ?? "public";
  return one(
    await db
      .insert(media)
      .values({
        bucket:
          opts.bucket ??
          (visibility === "public" ? "codekraft-dev-public" : "codekraft-dev-private"),
        objectKey: opts.objectKey ?? `factory/media-${String(n).padStart(4, "0")}.png`,
        mime: opts.mime ?? "image/png",
        sizeBytes: opts.sizeBytes ?? 1024,
        width: opts.width ?? 1200,
        height: opts.height ?? 630,
        checksum: opts.checksum ?? n.toString(16).padStart(64, "0"),
        visibility,
        uploadedBy,
      })
      .returning(),
    "media",
  );
}
