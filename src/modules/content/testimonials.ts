/** API-CONT-05 testimonials (site / product context), API-CONT-06 client logos, API-CONT-07 FAQs. */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import type { DbOrTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { products } from "../../../drizzle/schema/catalog";
import {
  clientLogos,
  faqs,
  testimonials,
  type ClientLogo,
  type Faq,
  type Testimonial,
} from "../../../drizzle/schema/content";
import { media } from "../../../drizzle/schema/media";
import type { UpsertClientLogoInput, UpsertFaqInput, UpsertTestimonialInput } from "./contracts";
import { type ContentDeps, assertPublishFlag } from "./deps";
import { notFound, reader, runInTx, snapshot } from "./internal";
import { applyOrder } from "./services";

type Id = { id: string };
type Reorder = { ids: string[] };

/** Slug of a product or `VALIDATION` when it does not exist. */
export async function requireProductSlug(
  db: DbOrTx,
  productId: string | undefined,
  field = "productId",
): Promise<string | null> {
  if (productId === undefined) return null;
  const [row] = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (row === undefined) {
    throw new AppError(ErrorCode.VALIDATION, "Unknown product", {
      fieldErrors: { [field]: ["product not found"] },
    });
  }
  return row.slug;
}

/** `VALIDATION` unless every id is a `public` media object (image kinds, API-CAT-06). */
export async function requirePublicMedia(
  db: DbOrTx,
  ids: readonly (string | undefined)[],
  field: string,
): Promise<void> {
  const wanted = Array.from(new Set(ids.filter((id): id is string => typeof id === "string")));
  if (wanted.length === 0) return;
  const rows = await db
    .select({ id: media.id, visibility: media.visibility })
    .from(media)
    .where(inArray(media.id, wanted));
  const ok = new Set(rows.filter((r) => r.visibility === "public").map((r) => r.id));
  const bad = wanted.filter((id) => !ok.has(id));
  if (bad.length > 0) {
    throw new AppError(ErrorCode.VALIDATION, "Media must exist and be public", {
      fieldErrors: { [field]: bad.map((id) => `${id}: not a public media object`) },
    });
  }
}

export function createTestimonialOps(deps: ContentDeps) {
  const orderT = [asc(testimonials.position), asc(testimonials.createdAt)];
  const orderL = [asc(clientLogos.position), asc(clientLogos.createdAt)];
  const orderF = [asc(faqs.position), asc(faqs.createdAt)];

  return {
    /* --- testimonials ------------------------------------------------------------------- */

    async upsertTestimonial(
      ctx: RequestContext,
      input: UpsertTestimonialInput,
      tx?: DbOrTx,
    ): Promise<{ testimonial: Testimonial; productSlug: string | null }> {
      return runInTx(tx, async (t) => {
        let existing: Testimonial | undefined;
        if (input.id !== undefined) {
          [existing] = await t.select().from(testimonials).where(eq(testimonials.id, input.id)).limit(1);
          if (existing === undefined) throw notFound("testimonial");
        }
        assertPublishFlag(ctx, existing?.published, input.published);
        const productId = input.context === "product" ? input.productId : undefined;
        const productSlug = await requireProductSlug(t, productId);
        await requirePublicMedia(t, [input.avatarMediaId], "avatarMediaId");
        const values = {
          quote: input.quote,
          authorName: input.authorName,
          authorTitle: input.authorTitle ?? null,
          company: input.company ?? null,
          avatarMediaId: input.avatarMediaId ?? null,
          context: input.context,
          productId: productId ?? null,
          position: input.position,
          published: input.published,
          updatedAt: deps.now(),
        };
        const [testimonial] =
          existing === undefined
            ? await t.insert(testimonials).values(values).returning()
            : await t.update(testimonials).set(values).where(eq(testimonials.id, existing.id)).returning();
        if (testimonial === undefined) throw new Error("testimonials upsert returned no row");
        await deps.audit.log(
          ctx,
          existing === undefined ? "API-CONT-05 testimonial.create" : "API-CONT-05 testimonial.update",
          { type: "testimonial", id: testimonial.id },
          snapshot(existing ?? null),
          snapshot(testimonial),
          t,
        );
        return { testimonial, productSlug };
      });
    },

    async deleteTestimonial(
      ctx: RequestContext,
      input: Id,
      tx?: DbOrTx,
    ): Promise<{ productSlug: string | null }> {
      return runInTx(tx, async (t) => {
        const [existing] = await t.delete(testimonials).where(eq(testimonials.id, input.id)).returning();
        if (existing === undefined) throw notFound("testimonial");
        const productSlug =
          existing.productId === null ? null : await productSlugOrNull(t, existing.productId);
        await deps.audit.log(
          ctx,
          "API-CONT-05 testimonial.delete",
          { type: "testimonial", id: existing.id },
          snapshot(existing),
          null,
          t,
        );
        return { productSlug };
      });
    },

    async reorderTestimonials(
      ctx: RequestContext,
      input: Reorder,
      tx?: DbOrTx,
    ): Promise<{ testimonials: Testimonial[] }> {
      return runInTx(tx, async (t) => {
        const all = await t.select().from(testimonials);
        const order = applyOrder(all, input.ids);
        const now = deps.now();
        for (const { id, position } of order) {
          await t.update(testimonials).set({ position, updatedAt: now }).where(eq(testimonials.id, id));
        }
        const rows = await t.select().from(testimonials).orderBy(...orderT);
        await deps.audit.log(
          ctx,
          "API-CONT-05 testimonial.reorder",
          { type: "testimonial", id: "*" },
          snapshot(all.map((r) => ({ id: r.id, position: r.position }))),
          snapshot(order),
          t,
        );
        return { testimonials: rows };
      });
    },

    listTestimonialsAdmin(tx?: DbOrTx): Promise<Testimonial[]> {
      return reader(tx).select().from(testimonials).orderBy(...orderT);
    },

    /** Published rows for a context, optionally one product (by slug), with the product slug. */
    async listPublishedTestimonials(
      input: { context: Testimonial["context"]; productSlug?: string },
      tx?: DbOrTx,
    ): Promise<{ row: Testimonial; productSlug: string | null }[]> {
      const conditions = [eq(testimonials.published, true), eq(testimonials.context, input.context)];
      if (input.productSlug !== undefined) conditions.push(eq(products.slug, input.productSlug));
      const rows = await reader(tx)
        .select({ row: testimonials, productSlug: products.slug })
        .from(testimonials)
        .leftJoin(products, eq(products.id, testimonials.productId))
        .where(and(...conditions))
        .orderBy(...orderT);
      return rows.map((r) => ({ row: r.row, productSlug: r.productSlug ?? null }));
    },

    /* --- client logos ------------------------------------------------------------------- */

    async upsertClientLogo(
      ctx: RequestContext,
      input: UpsertClientLogoInput,
      tx?: DbOrTx,
    ): Promise<{ logo: ClientLogo }> {
      return runInTx(tx, async (t) => {
        let existing: ClientLogo | undefined;
        if (input.id !== undefined) {
          [existing] = await t.select().from(clientLogos).where(eq(clientLogos.id, input.id)).limit(1);
          if (existing === undefined) throw notFound("client logo");
        }
        assertPublishFlag(ctx, existing?.published, input.published);
        await requirePublicMedia(t, [input.mediaId], "mediaId");
        const values = {
          name: input.name,
          mediaId: input.mediaId,
          url: input.url ?? null,
          position: input.position,
          published: input.published,
          updatedAt: deps.now(),
        };
        const [logo] =
          existing === undefined
            ? await t.insert(clientLogos).values(values).returning()
            : await t.update(clientLogos).set(values).where(eq(clientLogos.id, existing.id)).returning();
        if (logo === undefined) throw new Error("client_logos upsert returned no row");
        await deps.audit.log(
          ctx,
          existing === undefined ? "API-CONT-06 client_logo.create" : "API-CONT-06 client_logo.update",
          { type: "client_logo", id: logo.id },
          snapshot(existing ?? null),
          snapshot(logo),
          t,
        );
        return { logo };
      });
    },

    async deleteClientLogo(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<void> {
      return runInTx(tx, async (t) => {
        const [existing] = await t.delete(clientLogos).where(eq(clientLogos.id, input.id)).returning();
        if (existing === undefined) throw notFound("client logo");
        await deps.audit.log(
          ctx,
          "API-CONT-06 client_logo.delete",
          { type: "client_logo", id: existing.id },
          snapshot(existing),
          null,
          t,
        );
      });
    },

    async reorderClientLogos(
      ctx: RequestContext,
      input: Reorder,
      tx?: DbOrTx,
    ): Promise<{ logos: ClientLogo[] }> {
      return runInTx(tx, async (t) => {
        const all = await t.select().from(clientLogos);
        const order = applyOrder(all, input.ids);
        const now = deps.now();
        for (const { id, position } of order) {
          await t.update(clientLogos).set({ position, updatedAt: now }).where(eq(clientLogos.id, id));
        }
        const rows = await t.select().from(clientLogos).orderBy(...orderL);
        await deps.audit.log(
          ctx,
          "API-CONT-06 client_logo.reorder",
          { type: "client_logo", id: "*" },
          snapshot(all.map((r) => ({ id: r.id, position: r.position }))),
          snapshot(order),
          t,
        );
        return { logos: rows };
      });
    },

    listClientLogosAdmin(tx?: DbOrTx): Promise<ClientLogo[]> {
      return reader(tx).select().from(clientLogos).orderBy(...orderL);
    },

    listPublishedClientLogos(tx?: DbOrTx): Promise<ClientLogo[]> {
      return reader(tx).select().from(clientLogos).where(eq(clientLogos.published, true)).orderBy(...orderL);
    },

    /* --- FAQs --------------------------------------------------------------------------- */

    async upsertFaq(
      ctx: RequestContext,
      input: UpsertFaqInput,
      tx?: DbOrTx,
    ): Promise<{ faq: Faq; productSlug: string | null }> {
      return runInTx(tx, async (t) => {
        let existing: Faq | undefined;
        if (input.id !== undefined) {
          [existing] = await t.select().from(faqs).where(eq(faqs.id, input.id)).limit(1);
          if (existing === undefined) throw notFound("faq");
        }
        assertPublishFlag(ctx, existing?.published, input.published);
        const productId = input.scope === "product" ? input.productId : undefined;
        const productSlug = await requireProductSlug(t, productId);
        const values = {
          question: input.question,
          answerJson: input.answerJson,
          scope: input.scope,
          productId: productId ?? null,
          position: input.position,
          published: input.published,
          updatedAt: deps.now(),
        };
        const [faq] =
          existing === undefined
            ? await t.insert(faqs).values(values).returning()
            : await t.update(faqs).set(values).where(eq(faqs.id, existing.id)).returning();
        if (faq === undefined) throw new Error("faqs upsert returned no row");
        await deps.audit.log(
          ctx,
          existing === undefined ? "API-CONT-07 faq.create" : "API-CONT-07 faq.update",
          { type: "faq", id: faq.id },
          snapshot(existing ?? null),
          snapshot(faq),
          t,
        );
        return { faq, productSlug };
      });
    },

    async deleteFaq(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<{ productSlug: string | null }> {
      return runInTx(tx, async (t) => {
        const [existing] = await t.delete(faqs).where(eq(faqs.id, input.id)).returning();
        if (existing === undefined) throw notFound("faq");
        const productSlug =
          existing.productId === null ? null : await productSlugOrNull(t, existing.productId);
        await deps.audit.log(
          ctx,
          "API-CONT-07 faq.delete",
          { type: "faq", id: existing.id },
          snapshot(existing),
          null,
          t,
        );
        return { productSlug };
      });
    },

    async reorderFaqs(ctx: RequestContext, input: Reorder, tx?: DbOrTx): Promise<{ faqs: Faq[] }> {
      return runInTx(tx, async (t) => {
        const all = await t.select().from(faqs);
        const order = applyOrder(all, input.ids);
        const now = deps.now();
        for (const { id, position } of order) {
          await t.update(faqs).set({ position, updatedAt: now }).where(eq(faqs.id, id));
        }
        const rows = await t.select().from(faqs).orderBy(...orderF);
        await deps.audit.log(
          ctx,
          "API-CONT-07 faq.reorder",
          { type: "faq", id: "*" },
          snapshot(all.map((r) => ({ id: r.id, position: r.position }))),
          snapshot(order),
          t,
        );
        return { faqs: rows };
      });
    },

    async listFaqsAdmin(input: { scope?: Faq["scope"] } = {}, tx?: DbOrTx): Promise<Faq[]> {
      const q = reader(tx).select().from(faqs);
      const rows = input.scope === undefined ? await q.orderBy(...orderF) : await q.where(eq(faqs.scope, input.scope)).orderBy(...orderF);
      return rows;
    },

    async listPublishedFaqs(
      input: { scope: Faq["scope"]; productSlug?: string },
      tx?: DbOrTx,
    ): Promise<{ row: Faq; productSlug: string | null }[]> {
      const conditions = [eq(faqs.published, true), eq(faqs.scope, input.scope)];
      if (input.productSlug !== undefined) conditions.push(eq(products.slug, input.productSlug));
      const rows = await reader(tx)
        .select({ row: faqs, productSlug: products.slug })
        .from(faqs)
        .leftJoin(products, eq(products.id, faqs.productId))
        .where(and(...conditions))
        .orderBy(...orderF);
      return rows.map((r) => ({ row: r.row, productSlug: r.productSlug ?? null }));
    },
  };
}

async function productSlugOrNull(db: DbOrTx, productId: string): Promise<string | null> {
  const [row] = await db.select({ slug: products.slug }).from(products).where(eq(products.id, productId)).limit(1);
  return row?.slug ?? null;
}
