/**
 * API-CONT-08 legal pages (D-807, FR-CONT-04): `updateLegalPage` saves the draft text without a
 * version bump; `publishLegalPage` snapshots into `legal_page_versions` (immutable, retained
 * 7 years) and stamps `published_at`. The public page serves the latest published version only.
 *
 * Version numbering: a page that has never been published keeps its current `version` (1) for
 * the first snapshot; every later publish is `version += 1`.
 */
import { asc, desc, eq, sql } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import type { DbOrTx } from "@/lib/db";
import {
  legalPageVersions,
  legalPages,
  type LegalPage,
  type LegalPageVersion,
} from "../../../drizzle/schema/content";
import type { UpdateLegalPageInput } from "./contracts";
import { type ContentDeps, assertCanPublish } from "./deps";
import { notFound, reader, runInTx, snapshot } from "./internal";
import type { LegalPageKey } from "./types";

export function createLegalOps(deps: ContentDeps) {
  return {
    async updateLegalPage(
      ctx: RequestContext,
      input: UpdateLegalPageInput,
      tx?: DbOrTx,
    ): Promise<{ page: LegalPage }> {
      return runInTx(tx, async (t) => {
        const [existing] = await t.select().from(legalPages).where(eq(legalPages.key, input.key)).limit(1);
        const values = { key: input.key, title: input.title, bodyJson: input.bodyJson, updatedAt: deps.now() };
        const [page] = await t
          .insert(legalPages)
          .values(values)
          .onConflictDoUpdate({ target: legalPages.key, set: values })
          .returning();
        if (page === undefined) throw new Error("legal_pages upsert returned no row");
        await deps.audit.log(
          ctx,
          "API-CONT-08 legal_page.update",
          { type: "legal_page", id: page.id },
          snapshot(existing === undefined ? null : { title: existing.title, bodyJson: existing.bodyJson }),
          snapshot({ title: page.title, bodyJson: page.bodyJson }),
          t,
        );
        return { page };
      });
    },

    async publishLegalPage(
      ctx: RequestContext,
      input: { key: LegalPageKey },
      tx?: DbOrTx,
    ): Promise<{ page: LegalPage; version: LegalPageVersion }> {
      assertCanPublish(ctx);
      return runInTx(tx, async (t) => {
        const [existing] = await t.select().from(legalPages).where(eq(legalPages.key, input.key)).limit(1);
        if (existing === undefined) throw notFound("legal page");
        const now = deps.now();
        const nextVersion = existing.publishedAt === null ? existing.version : existing.version + 1;
        const [page] = await t
          .update(legalPages)
          .set({ version: nextVersion, publishedAt: now, updatedAt: now })
          .where(eq(legalPages.id, existing.id))
          .returning();
        if (page === undefined) throw new Error("legal_pages update returned no row");
        const [version] = await t
          .insert(legalPageVersions)
          .values({
            legalPageId: page.id,
            version: nextVersion,
            bodyJson: page.bodyJson,
            publishedAt: now,
            publishedBy: ctx.userId,
          })
          .returning();
        if (version === undefined) throw new Error("legal_page_versions insert returned no row");
        await deps.audit.log(
          ctx,
          "API-CONT-08 legal_page.publish",
          { type: "legal_page", id: page.id },
          snapshot({ version: existing.version, publishedAt: existing.publishedAt }),
          snapshot({ version: page.version, publishedAt: page.publishedAt, versionId: version.id }),
          t,
        );
        return { page, version };
      });
    },

    /** Admin read: every page with its published-version count. */
    async listLegalPagesAdmin(tx?: DbOrTx): Promise<(LegalPage & { versionCount: number })[]> {
      const rows = await reader(tx)
        .select({
          page: legalPages,
          versionCount: sql<number>`(select count(*)::int from ${legalPageVersions} where ${legalPageVersions.legalPageId} = ${legalPages.id})`,
        })
        .from(legalPages)
        .orderBy(asc(legalPages.key));
      return rows.map((r) => ({ ...r.page, versionCount: r.versionCount }));
    },

    /** Admin read: version history, newest first. */
    async listLegalPageVersions(key: LegalPageKey, tx?: DbOrTx): Promise<LegalPageVersion[]> {
      return reader(tx)
        .select({ v: legalPageVersions })
        .from(legalPageVersions)
        .innerJoin(legalPages, eq(legalPages.id, legalPageVersions.legalPageId))
        .where(eq(legalPages.key, key))
        .orderBy(desc(legalPageVersions.version))
        .then((rows) => rows.map((r) => r.v));
    },

    /** The page and its latest published version (`undefined` when never published). */
    async findLatestPublished(
      key: LegalPageKey,
      tx?: DbOrTx,
    ): Promise<{ page: LegalPage; version: LegalPageVersion } | undefined> {
      const [row] = await reader(tx)
        .select({ page: legalPages, version: legalPageVersions })
        .from(legalPages)
        .innerJoin(legalPageVersions, eq(legalPageVersions.legalPageId, legalPages.id))
        .where(eq(legalPages.key, key))
        .orderBy(desc(legalPageVersions.version))
        .limit(1);
      return row;
    },

    /** Every page's latest published version (knowledge indexing). */
    async listLatestPublished(tx?: DbOrTx): Promise<{ page: LegalPage; version: LegalPageVersion }[]> {
      const rows = await reader(tx)
        .select({ page: legalPages, version: legalPageVersions })
        .from(legalPages)
        .innerJoin(legalPageVersions, eq(legalPageVersions.legalPageId, legalPages.id))
        .orderBy(asc(legalPages.key), desc(legalPageVersions.version));
      const out: { page: LegalPage; version: LegalPageVersion }[] = [];
      const seen = new Set<string>();
      for (const row of rows) {
        if (seen.has(row.page.id)) continue;
        seen.add(row.page.id);
        out.push(row);
      }
      return out;
    },
  };
}
