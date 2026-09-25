/**
 * Product versions, FAQs and testimonials (PHASE-03 P3.7; docs/06 API-CAT-07/08/09; D-313,
 * D-312, D-604). Members of the frozen `CatalogService` contract, assembled by `./service.ts`.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import { type DbOrTx, type TxCtx, withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { moduleLogger } from "@/lib/logger";
import { isForeignKeyViolation, isUniqueViolation } from "@/modules/approvals/pg-errors";
import { entitlements, releaseFiles } from "../../../drizzle/schema/delivery";
import { media } from "../../../drizzle/schema/media";
import {
  type Product,
  productFaqs,
  productTestimonials,
  productVersions,
  products,
} from "../../../drizzle/schema/catalog";
import { productTags as tagsFor } from "./cache";
import type { CatalogService } from "./contracts";
import type { CatalogDeps } from "./deps";
import { loadProductForWrite } from "./scope";
import type { ImageRef, ProductFaqView, ProductTestimonialView } from "./types";
import { toFaqView, toImageRef, toTestimonialView, toVersionView } from "./views";

const log = moduleLogger("catalog.extras");

type ExtrasMembers = Pick<
  CatalogService,
  | "createProductVersion"
  | "upsertProductFaq"
  | "deleteProductFaq"
  | "reorderProductFaqs"
  | "upsertProductTestimonial"
  | "deleteProductTestimonial"
>;

export function semverMajor(version: string | null | undefined): number | null {
  if (version === null || version === undefined) return null;
  const m = /^(\d+)\./.exec(version);
  return m === null ? null : Number(m[1]);
}

/** Entitlement holders whose `update_policy` grants this release (docs/06 API-CAT-07). */
export function holderGetsUpdate(
  holder: { updatePolicy: string; accessEndsAt: Date | null },
  previousVersion: string | null,
  newVersion: string,
  now: Date,
): boolean {
  switch (holder.updatePolicy) {
    case "all_free":
      return true;
    case "during_access":
      return holder.accessEndsAt === null || holder.accessEndsAt.getTime() > now.getTime();
    case "major_paid": {
      const prev = semverMajor(previousVersion);
      const next = semverMajor(newVersion);
      return prev !== null && next !== null && prev === next;
    }
    default:
      return false;
  }
}

export async function listFaqs(productId: string, db: DbOrTx): Promise<ProductFaqView[]> {
  const rows = await db
    .select()
    .from(productFaqs)
    .where(eq(productFaqs.productId, productId))
    .orderBy(asc(productFaqs.position), asc(productFaqs.createdAt));
  return rows.map(toFaqView);
}

export async function loadAvatars(
  mediaIds: readonly (string | null)[],
  deps: Pick<CatalogDeps, "mediaUrl">,
  db: DbOrTx,
): Promise<Map<string, ImageRef>> {
  const ids = [...new Set(mediaIds.filter((id): id is string => id !== null))];
  const out = new Map<string, ImageRef>();
  if (ids.length === 0) return out;
  const rows = await db.select().from(media).where(inArray(media.id, ids));
  for (const row of rows) out.set(row.id, toImageRef(row, await deps.mediaUrl(row), "Avatar"));
  return out;
}

export async function listTestimonials(
  productId: string,
  deps: Pick<CatalogDeps, "mediaUrl">,
  db: DbOrTx,
  publishedOnly: boolean,
): Promise<(ProductTestimonialView & { position: number; published: boolean })[]> {
  const rows = await db
    .select()
    .from(productTestimonials)
    .where(
      publishedOnly
        ? and(eq(productTestimonials.productId, productId), eq(productTestimonials.published, true))
        : eq(productTestimonials.productId, productId),
    )
    .orderBy(asc(productTestimonials.position), asc(productTestimonials.createdAt));
  const avatars = await loadAvatars(
    rows.map((r) => r.avatarMediaId),
    deps,
    db,
  );
  return rows.map((r) =>
    toTestimonialView(r, r.avatarMediaId === null ? null : (avatars.get(r.avatarMediaId) ?? null)),
  );
}

export function createCatalogExtras(deps: CatalogDeps): ExtrasMembers {
  const now = deps.now ?? (() => new Date());
  const run = <T>(fn: (tx: TxCtx) => Promise<T>, tx?: DbOrTx) =>
    withTx(fn, tx as TxCtx | undefined, deps.txRunner);

  async function revalidateProduct(product: Product, extra: readonly string[] = []) {
    if (product.status !== "published") return;
    await deps.revalidate(tagsFor(extra, product.slug));
  }

  async function touch(product: Product, ctx: RequestContext, tx: TxCtx) {
    await tx
      .update(products)
      .set({ updatedAt: now(), updatedBy: ctx.userId })
      .where(eq(products.id, product.id));
  }

  return {
    createProductVersion(ctx, input, tx) {
      return run(async (t) => {
        const product = await loadProductForWrite(ctx, input.productId, t);
        let row;
        try {
          [row] = await t
            .insert(productVersions)
            .values({
              productId: product.id,
              version: input.version,
              changelogJson: input.changelogJson,
              createdBy: ctx.userId,
              releasedAt: now(),
            })
            .returning();
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new AppError(ErrorCode.CONFLICT, `Version ${input.version} already exists.`);
          }
          throw err;
        }
        if (row === undefined) throw new AppError(ErrorCode.INTERNAL, "version insert returned no row");
        if (input.releaseFile !== undefined) {
          const [file] = await t
            .select({ id: media.id, visibility: media.visibility })
            .from(media)
            .where(eq(media.id, input.releaseFile.mediaId))
            .limit(1);
          if (file === undefined) {
            throw new AppError(ErrorCode.VALIDATION, "Release file media not found.", {
              fieldErrors: { "releaseFile.mediaId": ["unknown media"] },
            });
          }
          if (file.visibility !== "private") {
            throw new AppError(ErrorCode.VALIDATION, "Release files must be private media (D-604).", {
              fieldErrors: { "releaseFile.mediaId": ["release files must be private"] },
            });
          }
          await t.insert(releaseFiles).values({
            productId: product.id,
            version: input.version,
            mediaId: input.releaseFile.mediaId,
            notes: input.releaseFile.notes ?? null,
            releasedAt: row.releasedAt,
          });
        }
        await t
          .update(products)
          .set({ currentVersion: input.version, updatedAt: now(), updatedBy: ctx.userId })
          .where(eq(products.id, product.id));

        // N: product.updated to active holders whose update policy grants the release.
        const holders = await t
          .select({
            userId: entitlements.userId,
            updatePolicy: entitlements.updatePolicy,
            accessEndsAt: entitlements.accessEndsAt,
          })
          .from(entitlements)
          .where(and(eq(entitlements.productId, product.id), eq(entitlements.status, "active")));
        const at = now();
        const recipients = [
          ...new Set(
            holders
              .filter((h) => holderGetsUpdate(h, product.currentVersion, input.version, at))
              .map((h) => h.userId),
          ),
        ];
        if (recipients.length > 0) {
          try {
            await deps.notifications.emit(
              recipients,
              "product.updated",
              {
                productId: product.id,
                slug: product.slug,
                name: product.name,
                version: input.version,
                summary: input.changelogJson.summary ?? null,
              },
              undefined,
              t,
            );
          } catch (err) {
            log.warn({ err, productId: product.id }, "product.updated notification failed");
          }
        }
        await deps.audit.log(
          ctx,
          "API-CAT-07 product.version.create",
          { type: "product", id: product.id },
          { currentVersion: product.currentVersion },
          { currentVersion: input.version, releaseFile: input.releaseFile?.mediaId ?? null },
          t,
        );
        await revalidateProduct(product, ["catalog"]);
        return { version: toVersionView(row) };
      }, tx);
    },

    upsertProductFaq(ctx, input, tx) {
      return run(async (t) => {
        const product = await loadProductForWrite(ctx, input.productId, t);
        let before = null;
        if (input.faqId === undefined) {
          await t.insert(productFaqs).values({
            productId: product.id,
            question: input.question,
            answerJson: input.answerJson,
            position: input.position,
          });
        } else {
          const [existing] = await t
            .select()
            .from(productFaqs)
            .where(and(eq(productFaqs.id, input.faqId), eq(productFaqs.productId, product.id)))
            .limit(1);
          if (existing === undefined) throw new AppError(ErrorCode.NOT_FOUND, "FAQ not found.");
          before = existing;
          await t
            .update(productFaqs)
            .set({
              question: input.question,
              answerJson: input.answerJson,
              position: input.position,
              updatedAt: now(),
            })
            .where(eq(productFaqs.id, existing.id));
        }
        await touch(product, ctx, t);
        const faqs = await listFaqs(product.id, t);
        await deps.audit.log(
          ctx,
          "API-CAT-08 product.faq.upsert",
          { type: "product", id: product.id },
          before,
          { faqId: input.faqId ?? null, question: input.question, position: input.position },
          t,
        );
        await revalidateProduct(product);
        await deps.reindex?.(product.id, t);
        return { faqs };
      }, tx);
    },

    deleteProductFaq(ctx, input, tx) {
      return run(async (t) => {
        const product = await loadProductForWrite(ctx, input.productId, t);
        const deleted = await t
          .delete(productFaqs)
          .where(and(eq(productFaqs.id, input.faqId), eq(productFaqs.productId, product.id)))
          .returning();
        if (deleted.length === 0) throw new AppError(ErrorCode.NOT_FOUND, "FAQ not found.");
        await touch(product, ctx, t);
        const faqs = await listFaqs(product.id, t);
        await deps.audit.log(
          ctx,
          "API-CAT-08 product.faq.delete",
          { type: "product", id: product.id },
          deleted[0] ?? null,
          null,
          t,
        );
        await revalidateProduct(product);
        await deps.reindex?.(product.id, t);
        return { faqs };
      }, tx);
    },

    reorderProductFaqs(ctx, input, tx) {
      return run(async (t) => {
        const product = await loadProductForWrite(ctx, input.productId, t);
        const current = await listFaqs(product.id, t);
        const known = new Set(current.map((f) => f.id));
        const unknown = input.faqIds.filter((id) => !known.has(id));
        if (unknown.length > 0 || new Set(input.faqIds).size !== input.faqIds.length) {
          throw new AppError(ErrorCode.VALIDATION, "faqIds must be distinct FAQs of this product.", {
            fieldErrors: { faqIds: ["unknown or duplicate FAQ id"] },
          });
        }
        const ordered = [
          ...input.faqIds,
          ...current.map((f) => f.id).filter((id) => !input.faqIds.includes(id)),
        ];
        for (const [index, id] of ordered.entries()) {
          await t.update(productFaqs).set({ position: index, updatedAt: now() }).where(eq(productFaqs.id, id));
        }
        await touch(product, ctx, t);
        const faqs = await listFaqs(product.id, t);
        await deps.audit.log(
          ctx,
          "API-CAT-08 product.faq.reorder",
          { type: "product", id: product.id },
          { order: current.map((f) => f.id) },
          { order: ordered },
          t,
        );
        await revalidateProduct(product);
        return { faqs };
      }, tx);
    },

    upsertProductTestimonial(ctx, input, tx) {
      return run(async (t) => {
        const product = await loadProductForWrite(ctx, input.productId, t);
        const values = {
          authorName: input.authorName,
          authorTitle: input.authorTitle ?? null,
          company: input.company ?? null,
          quote: input.quote,
          avatarMediaId: input.avatarMediaId ?? null,
          position: input.position,
          published: input.published,
          updatedAt: now(),
        };
        let before = null;
        try {
          if (input.id === undefined) {
            await t.insert(productTestimonials).values({ productId: product.id, ...values });
          } else {
            const [existing] = await t
              .select()
              .from(productTestimonials)
              .where(and(eq(productTestimonials.id, input.id), eq(productTestimonials.productId, product.id)))
              .limit(1);
            if (existing === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Testimonial not found.");
            before = existing;
            await t.update(productTestimonials).set(values).where(eq(productTestimonials.id, existing.id));
          }
        } catch (err) {
          if (isForeignKeyViolation(err)) {
            throw new AppError(ErrorCode.VALIDATION, "Avatar media not found.", {
              fieldErrors: { avatarMediaId: ["unknown media"] },
            });
          }
          throw err;
        }
        await touch(product, ctx, t);
        const testimonials = await listTestimonials(product.id, deps, t, false);
        await deps.audit.log(
          ctx,
          "API-CAT-09 product.testimonial.upsert",
          { type: "product", id: product.id },
          before,
          { id: input.id ?? null, ...values },
          t,
        );
        await revalidateProduct(product);
        return { testimonials };
      }, tx);
    },

    deleteProductTestimonial(ctx, input, tx) {
      return run(async (t) => {
        const product = await loadProductForWrite(ctx, input.productId, t);
        const deleted = await t
          .delete(productTestimonials)
          .where(and(eq(productTestimonials.id, input.id), eq(productTestimonials.productId, product.id)))
          .returning();
        if (deleted.length === 0) throw new AppError(ErrorCode.NOT_FOUND, "Testimonial not found.");
        await touch(product, ctx, t);
        const testimonials = await listTestimonials(product.id, deps, t, false);
        await deps.audit.log(
          ctx,
          "API-CAT-09 product.testimonial.delete",
          { type: "product", id: product.id },
          deleted[0] ?? null,
          null,
          t,
        );
        await revalidateProduct(product);
        return { testimonials };
      }, tx);
    },
  };
}

