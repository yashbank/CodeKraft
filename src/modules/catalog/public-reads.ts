/**
 * Public catalog reads (docs/06 API-CAT-31 `getProductBySlug`, API-CAT-32 `listCategories`,
 * API-CAT-34 `listFeaturedProducts`; D-314, BR-02). Visibility: `published` for everyone,
 * `unpublished` only for entitlement holders, every status for `catalog.read` holders (admin
 * preview, docs/06 §5.5 step 2). The public payload never carries ownership (BR-02).
 */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { can } from "@/lib/authz/assert";
import { type Context, isAuthenticated } from "@/lib/authz/context";
import { type DbOrTx, db as defaultDb } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import type { ProductMediaView } from "@/modules/media/types";
import type { BlogTeaser } from "@/modules/blog/types";
import {
  categories,
  featuredProducts,
  productBlogs,
  productMedia,
  products,
  productVersions,
} from "../../../drizzle/schema/catalog";
import { media } from "../../../drizzle/schema/media";
import { loadProductCards } from "./cards";
import type { CatalogService } from "./contracts";
import type { CatalogDeps } from "./deps";
import { listFaqs, listTestimonials } from "./extras";
import { loadTagsFor } from "./tags";
import type { Breadcrumb, CategoryNode, ImageRef, ProductDetail } from "./types";
import { tiptapToText, toCategoryRef, toImageRef, toVersionView } from "./views";

type PublicMembers = Pick<CatalogService, "getProductBySlug" | "listCategories" | "listFeaturedProducts">;

/** `status = 'published' AND NOT is_unlisted` — the list/search visibility (D-314). */
export const listedCondition = and(eq(products.status, "published"), eq(products.isUnlisted, false));

export async function loadProductMedia(
  productId: string,
  deps: Pick<CatalogDeps, "mediaUrl">,
  db: DbOrTx,
): Promise<ProductMediaView[]> {
  const rows = await db
    .select({ pm: productMedia, m: media })
    .from(productMedia)
    .leftJoin(media, eq(media.id, productMedia.mediaId))
    .where(eq(productMedia.productId, productId))
    .orderBy(asc(productMedia.kind), asc(productMedia.position), asc(productMedia.createdAt));
  const out: ProductMediaView[] = [];
  for (const { pm, m } of rows) {
    const url =
      m === null
        ? (pm.embedUrl ?? "")
        : await deps.mediaUrl(m, pm.kind === "presentation" ? "product_presentation" : undefined);
    out.push({
      id: pm.id,
      kind: pm.kind,
      mediaId: pm.mediaId,
      url,
      embedUrl: pm.embedUrl,
      title: pm.title,
      alt: pm.alt,
      position: pm.position,
      mime: m?.mime ?? null,
      width: m?.width ?? null,
      height: m?.height ?? null,
      blurHash: m?.blurHash ?? null,
    });
  }
  return out;
}

export async function loadBlogTeaser(
  productId: string,
  deps: Pick<CatalogDeps, "mediaUrl">,
  db: DbOrTx,
): Promise<BlogTeaser | null> {
  const [row] = await db
    .select({ b: productBlogs, m: media })
    .from(productBlogs)
    .leftJoin(media, eq(media.id, productBlogs.coverMediaId))
    .where(and(eq(productBlogs.productId, productId), eq(productBlogs.status, "published")))
    .limit(1);
  if (row === undefined || row.b.publishedAt === null) return null;
  return {
    slug: row.b.slug,
    title: row.b.title,
    excerpt: row.b.excerpt,
    cover: row.m === null ? null : toImageRef(row.m, await deps.mediaUrl(row.m), row.b.title),
    publishedAt: row.b.publishedAt.toISOString(),
  };
}

export function buildBreadcrumbs(
  product: { name: string; slug: string },
  category: { name: string; slug: string } | null,
): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
  ];
  if (category !== null) crumbs.push({ label: category.name, href: `/products?category=${category.slug}` });
  crumbs.push({ label: product.name, href: `/products/${product.slug}` });
  return crumbs;
}

export function buildJsonLd(detail: Omit<ProductDetail, "jsonLd">, siteUrl: string): Record<string, unknown> {
  const offers = detail.offerings
    .filter((o) => o.status === "active" && o.price !== null)
    .map((o) => ({
      "@type": "Offer",
      name: o.name,
      price: (o.price!.display.amountMinor / 100).toFixed(2),
      priceCurrency: o.price!.display.currency,
      availability: detail.isComingSoon ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
      url: `${siteUrl}/products/${detail.slug}`,
    }));
  const image = detail.media.find((m) => m.kind === "image" || m.kind === "screenshot")?.url;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: detail.name,
    description: detail.description === null ? detail.shortDescription : tiptapToText(detail.description),
    sku: detail.slug,
    url: `${siteUrl}/products/${detail.slug}`,
    ...(image !== undefined && image !== "" ? { image } : {}),
    ...(detail.category !== null ? { category: detail.category.name } : {}),
    brand: { "@type": "Brand", name: "CodeKraft" },
    ...(offers.length > 0 ? { offers } : {}),
  };
}

export function createCatalogPublicReads(deps: CatalogDeps): PublicMembers {
  const readDb = (): DbOrTx => deps.db ?? defaultDb;

  async function canView(ctx: Context, product: { id: string; status: string }, db: DbOrTx) {
    if (product.status === "published") return true;
    if (isAuthenticated(ctx) && can(ctx, "catalog.read")) return true;
    if (product.status === "unpublished" && isAuthenticated(ctx)) {
      return deps.hasEntitlement(ctx.userId, product.id, db);
    }
    return false;
  }

  return {
    async getProductBySlug(ctx, input, tx) {
      const db = tx ?? readDb();
      const [row] = await db
        .select({ p: products, c: categories })
        .from(products)
        .leftJoin(categories, eq(categories.id, products.categoryId))
        .where(eq(products.slug, input.slug))
        .limit(1);
      if (row === undefined || !(await canView(ctx, row.p, db))) {
        throw new AppError(ErrorCode.NOT_FOUND, "Product not found.");
      }
      const p = row.p;
      const isAdminPreview = isAuthenticated(ctx) && can(ctx, "catalog.read");
      const [tags, mediaViews, offeringsAll, faqs, testimonials, versionRows, blogTeaser] =
        await Promise.all([
          loadTagsFor([p.id], db),
          loadProductMedia(p.id, deps, db),
          deps.offerings.listForProduct(p.id, input.displayCurrency, db),
          listFaqs(p.id, db),
          listTestimonials(p.id, deps, db, true),
          db
            .select()
            .from(productVersions)
            .where(eq(productVersions.productId, p.id))
            .orderBy(desc(productVersions.releasedAt), desc(productVersions.createdAt)),
          loadBlogTeaser(p.id, deps, db),
        ]);
      const offerings = isAdminPreview ? offeringsAll : offeringsAll.filter((o) => o.status === "active");
      const ogFromMedia = mediaViews.find((m) => m.kind === "og");
      let ogImage: ImageRef | null = null;
      if (ogFromMedia !== undefined && ogFromMedia.mediaId !== null) {
        ogImage = {
          mediaId: ogFromMedia.mediaId,
          url: ogFromMedia.url,
          alt: ogFromMedia.alt,
          width: ogFromMedia.width,
          height: ogFromMedia.height,
          blurHash: ogFromMedia.blurHash,
        };
      } else if (p.ogImageMediaId !== null) {
        const [og] = await db.select().from(media).where(eq(media.id, p.ogImageMediaId)).limit(1);
        if (og !== undefined) ogImage = toImageRef(og, await deps.mediaUrl(og), p.name);
      }
      const category = toCategoryRef(row.c);
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
      const base: Omit<ProductDetail, "jsonLd"> = {
        id: p.id,
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.descriptionJson,
        status: p.status,
        category,
        tags: tags.get(p.id) ?? [],
        isFeatured: p.isFeatured,
        isUnlisted: p.isUnlisted,
        isComingSoon: p.isComingSoon,
        isRefundable: p.isRefundable,
        taxEnabled: p.taxEnabled,
        currentVersion: p.currentVersion,
        features: p.features ?? [],
        benefits: p.benefits ?? [],
        targetAudience: p.targetAudience ?? [],
        useCases: p.useCases ?? [],
        industry: p.industry,
        techStack: p.techStack,
        requirements: p.requirementsJson,
        liveDemoUrl: p.liveDemoUrl,
        media: mediaViews,
        offerings,
        faqs,
        testimonials: testimonials.map(({ position: _p, published: _pub, ...view }) => view),
        versions: versionRows.map(toVersionView),
        blogTeaser,
        seo: {
          title: p.seoTitle ?? p.name,
          description: p.seoDescription ?? p.shortDescription,
          canonicalUrl: p.canonicalUrl,
          ogImage,
        },
        breadcrumbs: buildBreadcrumbs(p, category),
      };
      return { ...base, jsonLd: buildJsonLd(base, siteUrl) };
    },

    async listCategories(_ctx, tx) {
      const db = tx ?? readDb();
      const [rows, counts] = await Promise.all([
        db.select().from(categories).orderBy(asc(categories.position), asc(categories.name)),
        db
          .select({ categoryId: products.categoryId, count: sql<number>`count(*)::int` })
          .from(products)
          .where(listedCondition)
          .groupBy(products.categoryId),
      ]);
      const countFor = new Map(counts.map((c) => [c.categoryId, c.count]));
      const nodes = new Map<string, CategoryNode>();
      for (const c of rows) {
        nodes.set(c.id, {
          id: c.id,
          slug: c.slug,
          name: c.name,
          parentId: c.parentId,
          position: c.position,
          description: c.description,
          productCount: countFor.get(c.id) ?? 0,
          children: [],
        });
      }
      const roots: CategoryNode[] = [];
      for (const node of nodes.values()) {
        const parent = node.parentId === null ? undefined : nodes.get(node.parentId);
        if (parent === undefined) roots.push(node);
        else parent.children.push(node);
      }
      for (const root of roots) {
        root.productCount += root.children.reduce((sum, child) => sum + child.productCount, 0);
      }
      return roots;
    },

    async listFeaturedProducts(_ctx, input, tx) {
      const db = tx ?? readDb();
      const rows = await db
        .select({ productId: featuredProducts.productId })
        .from(featuredProducts)
        .innerJoin(products, eq(products.id, featuredProducts.productId))
        .where(listedCondition)
        .orderBy(asc(featuredProducts.position), asc(featuredProducts.createdAt))
        .limit(input.limit);
      return loadProductCards(
        rows.map((r) => r.productId),
        input.displayCurrency,
        deps,
        db,
      );
    },
  };
}
