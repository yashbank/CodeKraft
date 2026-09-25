/** API-CONT-01 landing chapters (D-801, D-802) + API-CONT-02 featured products. */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import type { DbOrTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { featuredProducts, products } from "../../../drizzle/schema/catalog";
import { landingChapters, type LandingChapter } from "../../../drizzle/schema/content";
import type { SetFeaturedProductsInput, UpsertLandingChapterInput } from "./contracts";
import { type ContentDeps, assertPublishFlag } from "./deps";
import { reader, runInTx, snapshot } from "./internal";
import { LANDING_CHAPTER_KEYS } from "./types";

export function createLandingOps(deps: ContentDeps) {
  return {
    async upsertLandingChapter(
      ctx: RequestContext,
      input: UpsertLandingChapterInput,
      tx?: DbOrTx,
    ): Promise<{ chapter: LandingChapter }> {
      return runInTx(tx, async (t) => {
        const [existing] = await t
          .select()
          .from(landingChapters)
          .where(eq(landingChapters.key, input.key))
          .limit(1);
        assertPublishFlag(ctx, existing?.published, input.published);
        const values = {
          key: input.key,
          title: input.title,
          subtitle: input.subtitle ?? null,
          bodyJson: input.bodyJson,
          media: input.media,
          cta: input.cta,
          position: input.position,
          published: input.published,
          updatedAt: deps.now(),
        };
        const [chapter] = await t
          .insert(landingChapters)
          .values(values)
          .onConflictDoUpdate({ target: landingChapters.key, set: values })
          .returning();
        if (chapter === undefined) throw new Error("landing_chapters upsert returned no row");
        await deps.audit.log(
          ctx,
          "API-CONT-01 landing_chapter.upsert",
          { type: "landing_chapter", id: chapter.id },
          snapshot(existing ?? null),
          snapshot(chapter),
          t,
        );
        return { chapter };
      });
    },

    /** Admin read: every chapter row that exists, in key order (missing keys are absent). */
    async listLandingChaptersAdmin(tx?: DbOrTx): Promise<LandingChapter[]> {
      const rows = await reader(tx).select().from(landingChapters);
      const order = new Map(LANDING_CHAPTER_KEYS.map((k, i) => [k, i] as const));
      return rows.sort(
        (a, b) => a.position - b.position || (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0),
      );
    },

    async setFeaturedProducts(
      ctx: RequestContext,
      input: SetFeaturedProductsInput,
      tx?: DbOrTx,
    ): Promise<{ featured: { productId: string; position: number }[] }> {
      return runInTx(tx, async (t) => {
        if (input.productIds.length > 0) {
          const rows = await t
            .select({ id: products.id, status: products.status })
            .from(products)
            .where(inArray(products.id, input.productIds));
          const published = new Set(rows.filter((r) => r.status === "published").map((r) => r.id));
          const rejected = input.productIds.filter((id) => !published.has(id));
          if (rejected.length > 0) {
            throw new AppError(ErrorCode.VALIDATION, "Only published products can be featured", {
              fieldErrors: { productIds: rejected.map((id) => `${id}: not a published product`) },
            });
          }
        }
        const before = await t
          .select({ productId: featuredProducts.productId, position: featuredProducts.position })
          .from(featuredProducts)
          .orderBy(asc(featuredProducts.position));
        await t.delete(featuredProducts);
        const featured = input.productIds.map((productId, position) => ({ productId, position }));
        if (featured.length > 0) await t.insert(featuredProducts).values(featured);
        await deps.audit.log(
          ctx,
          "API-CONT-02 featured_products.set",
          { type: "featured_products", id: "landing" },
          snapshot(before),
          snapshot(featured),
          t,
        );
        return { featured };
      });
    },

    /** Current featured selection with the product slug/name/status (admin picker). */
    async listFeaturedProductsAdmin(tx?: DbOrTx) {
      return reader(tx)
        .select({
          productId: featuredProducts.productId,
          position: featuredProducts.position,
          slug: products.slug,
          name: products.name,
          status: products.status,
        })
        .from(featuredProducts)
        .innerJoin(products, eq(products.id, featuredProducts.productId))
        .orderBy(asc(featuredProducts.position));
    },

    /** Published featured products in landing order (ids + slugs; cards are the catalog's job). */
    async listFeaturedProductIds(tx?: DbOrTx): Promise<{ productId: string; slug: string }[]> {
      return reader(tx)
        .select({ productId: featuredProducts.productId, slug: products.slug })
        .from(featuredProducts)
        .innerJoin(
          products,
          and(eq(products.id, featuredProducts.productId), eq(products.status, "published")),
        )
        .orderBy(asc(featuredProducts.position));
    },
  };
}
