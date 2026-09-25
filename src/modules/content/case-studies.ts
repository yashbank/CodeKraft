/** API-CONT-04 case studies (D-803): upsert / publish / unpublish / delete + public reads. */
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import type { DbOrTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import type { ListResult } from "@/modules/_shared/zod";
import { caseStudies, type CaseStudy } from "../../../drizzle/schema/content";
import type { UpsertCaseStudyInput, listCaseStudiesSchema } from "./contracts";
import { type ContentDeps, assertCanPublish } from "./deps";
import { notFound, reader, rethrowConflict, runInTx, snapshot } from "./internal";
import { decodeCursor, encodeCursor, parseSort } from "./pagination";
import { recordSlugRedirect, resolveSlugRedirect } from "./slug-redirects";
import { requirePublicMedia } from "./testimonials";
import type { z } from "zod";

type Id = { id: string };
type ListInput = z.infer<typeof listCaseStudiesSchema>;

export interface CaseStudyMutation {
  caseStudy: CaseStudy;
  /** Slug before the mutation (differs from `caseStudy.slug` after a rename). */
  previousSlug: string | null;
}

export function createCaseStudyOps(deps: ContentDeps) {
  async function setPublished(
    ctx: RequestContext,
    input: Id,
    published: boolean,
    tx: DbOrTx | undefined,
  ): Promise<CaseStudyMutation> {
    assertCanPublish(ctx);
    return runInTx(tx, async (t) => {
      const [existing] = await t.select().from(caseStudies).where(eq(caseStudies.id, input.id)).limit(1);
      if (existing === undefined) throw notFound("case study");
      if (existing.published === published) {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          published ? "Case study is already published" : "Case study is not published",
        );
      }
      const now = deps.now();
      const [caseStudy] = await t
        .update(caseStudies)
        .set({
          published,
          publishedAt: published ? (existing.publishedAt ?? now) : existing.publishedAt,
          updatedAt: now,
        })
        .where(eq(caseStudies.id, existing.id))
        .returning();
      if (caseStudy === undefined) throw new Error("case_studies update returned no row");
      await deps.audit.log(
        ctx,
        published ? "API-CONT-04 case_study.publish" : "API-CONT-04 case_study.unpublish",
        { type: "case_study", id: caseStudy.id },
        snapshot({ published: existing.published, publishedAt: existing.publishedAt }),
        snapshot({ published: caseStudy.published, publishedAt: caseStudy.publishedAt }),
        t,
      );
      return { caseStudy, previousSlug: existing.slug };
    });
  }

  return {
    async upsertCaseStudy(
      ctx: RequestContext,
      input: UpsertCaseStudyInput,
      tx?: DbOrTx,
    ): Promise<CaseStudyMutation> {
      return runInTx(tx, async (t) => {
        let existing: CaseStudy | undefined;
        if (input.id !== undefined) {
          [existing] = await t.select().from(caseStudies).where(eq(caseStudies.id, input.id)).limit(1);
          if (existing === undefined) throw notFound("case study");
        }
        await requirePublicMedia(t, [input.coverMediaId], "coverMediaId");
        await requirePublicMedia(t, input.gallery.map((g) => g.mediaId), "gallery");
        const values = {
          slug: input.slug,
          title: input.title,
          clientName: input.clientName,
          industry: input.industry,
          problemJson: input.problemJson,
          solutionJson: input.solutionJson,
          resultsJson: input.resultsJson,
          techStack: input.techStack,
          coverMediaId: input.coverMediaId,
          gallery: input.gallery,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          updatedAt: deps.now(),
        };
        let caseStudy: CaseStudy | undefined;
        try {
          [caseStudy] =
            existing === undefined
              ? await t.insert(caseStudies).values(values).returning()
              : await t.update(caseStudies).set(values).where(eq(caseStudies.id, existing.id)).returning();
        } catch (err) {
          rethrowConflict(err, "slug", "A case study with this slug already exists");
        }
        if (caseStudy === undefined) throw new Error("case_studies upsert returned no row");
        if (existing !== undefined && existing.published && existing.slug !== caseStudy.slug) {
          await recordSlugRedirect(t, "case_study", existing.slug, caseStudy.slug);
        }
        await deps.audit.log(
          ctx,
          existing === undefined ? "API-CONT-04 case_study.create" : "API-CONT-04 case_study.update",
          { type: "case_study", id: caseStudy.id },
          snapshot(existing ?? null),
          snapshot(caseStudy),
          t,
        );
        return { caseStudy, previousSlug: existing?.slug ?? null };
      });
    },

    publishCaseStudy: (ctx: RequestContext, input: Id, tx?: DbOrTx) => setPublished(ctx, input, true, tx),
    unpublishCaseStudy: (ctx: RequestContext, input: Id, tx?: DbOrTx) => setPublished(ctx, input, false, tx),

    async deleteCaseStudy(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<{ slug: string }> {
      return runInTx(tx, async (t) => {
        const [existing] = await t.delete(caseStudies).where(eq(caseStudies.id, input.id)).returning();
        if (existing === undefined) throw notFound("case study");
        await deps.audit.log(
          ctx,
          "API-CONT-04 case_study.delete",
          { type: "case_study", id: existing.id },
          snapshot(existing),
          null,
          t,
        );
        return { slug: existing.slug };
      });
    },

    listCaseStudiesAdmin(tx?: DbOrTx): Promise<CaseStudy[]> {
      return reader(tx).select().from(caseStudies).orderBy(desc(caseStudies.updatedAt));
    },

    async findPublishedBySlug(slug: string, tx?: DbOrTx): Promise<CaseStudy | undefined> {
      const [row] = await reader(tx)
        .select()
        .from(caseStudies)
        .where(and(eq(caseStudies.slug, slug), eq(caseStudies.published, true)))
        .limit(1);
      return row;
    },

    /** Live slug for an old one (`null` when unknown) — for the route's 301. */
    resolveSlug(slug: string, tx?: DbOrTx): Promise<string | null> {
      return resolveSlugRedirect(reader(tx), "case_study", slug);
    },

    /** Published case studies, keyset-paginated (docs/06 §1.8), filters `industry` / `techStack`. */
    async listPublished(input: ListInput, tx?: DbOrTx): Promise<ListResult<CaseStudy>> {
      const sort = parseSort(input.sort, { field: "publishedAt", dir: "desc" });
      const conditions: SQL[] = [eq(caseStudies.published, true)];
      if (input.filters?.industry !== undefined) {
        conditions.push(eq(caseStudies.industry, input.filters.industry));
      }
      if (input.filters?.techStack !== undefined && input.filters.techStack.length > 0) {
        conditions.push(sql`${caseStudies.techStack} && ${input.filters.techStack}::text[]`);
      }
      if (input.q !== undefined && input.q !== "") {
        conditions.push(sql`${caseStudies.title} ILIKE ${`%${input.q}%`}`);
      }
      const sortCol = sort.field === "title" ? caseStudies.title : caseStudies.publishedAt;
      if (input.cursor !== undefined) {
        const c = decodeCursor(input.cursor);
        const value =
          sort.field === "title" ? sql`${String(c.value ?? "")}` : sql`${c.value === null ? null : new Date(String(c.value))}::timestamptz`;
        const op = sort.dir === "desc" ? sql`<` : sql`>`;
        conditions.push(sql`(${sortCol}, ${caseStudies.id}) ${op} (${value}, ${c.id}::uuid)`);
      }
      const where = and(...conditions);
      const direction = sort.dir === "desc" ? desc : asc;
      const rows = await reader(tx)
        .select()
        .from(caseStudies)
        .where(where)
        .orderBy(direction(sortCol), direction(caseStudies.id))
        .limit(input.limit + 1);
      const [{ total } = { total: 0 }] = await reader(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(caseStudies)
        .where(and(...conditions.slice(0, input.cursor === undefined ? conditions.length : -1)));
      const items = rows.slice(0, input.limit);
      const last = rows.length > input.limit ? items[items.length - 1] : undefined;
      const nextCursor =
        last === undefined
          ? null
          : encodeCursor({
              value: sort.field === "title" ? last.title : (last.publishedAt?.toISOString() ?? null),
              id: last.id,
            });
      return { items, nextCursor, total };
    },
  };
}
