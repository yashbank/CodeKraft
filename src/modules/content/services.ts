/** API-CONT-03 services (D-302, D-806): upsert / delete / reorder. */
import { asc, eq, inArray } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import type { DbOrTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { services, type Service } from "../../../drizzle/schema/content";
import type { UpsertServiceInput } from "./contracts";
import { type ContentDeps, assertPublishFlag } from "./deps";
import { notFound, reader, rethrowConflict, runInTx, snapshot } from "./internal";

type Id = { id: string };
type Reorder = { ids: string[] };

/** Assign `position = index` for `ids` (every id must exist in `all`). */
export function applyOrder<T extends { id: string; position: number }>(
  all: readonly T[],
  ids: readonly string[],
): { id: string; position: number }[] {
  const known = new Set(all.map((r) => r.id));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new AppError(ErrorCode.NOT_FOUND, `unknown ids: ${missing.join(", ")}`, {
      fieldErrors: { ids: missing.map((id) => `${id}: not found`) },
    });
  }
  const ordered = ids.map((id, position) => ({ id, position }));
  // Rows not mentioned keep their relative order after the reordered ones.
  const mentioned = new Set(ids);
  let next = ids.length;
  for (const row of [...all].sort((a, b) => a.position - b.position)) {
    if (!mentioned.has(row.id)) ordered.push({ id: row.id, position: next++ });
  }
  return ordered;
}

export function createServiceOps(deps: ContentDeps) {
  const listAll = (tx: DbOrTx | undefined) =>
    reader(tx).select().from(services).orderBy(asc(services.position), asc(services.createdAt));

  return {
    async upsertService(
      ctx: RequestContext,
      input: UpsertServiceInput,
      tx?: DbOrTx,
    ): Promise<{ service: Service }> {
      return runInTx(tx, async (t) => {
        let existing: Service | undefined;
        if (input.id !== undefined) {
          [existing] = await t.select().from(services).where(eq(services.id, input.id)).limit(1);
          if (existing === undefined) throw notFound("service");
        }
        assertPublishFlag(ctx, existing?.published, input.published);
        const values = {
          slug: input.slug,
          title: input.title,
          summary: input.summary,
          deliverables: input.deliverables,
          bodyJson: input.bodyJson,
          icon: input.icon,
          position: input.position,
          published: input.published,
          updatedAt: deps.now(),
        };
        let service: Service | undefined;
        try {
          [service] =
            existing === undefined
              ? await t.insert(services).values(values).returning()
              : await t.update(services).set(values).where(eq(services.id, existing.id)).returning();
        } catch (err) {
          rethrowConflict(err, "slug", "A service with this slug already exists");
        }
        if (service === undefined) throw new Error("services upsert returned no row");
        await deps.audit.log(
          ctx,
          existing === undefined ? "API-CONT-03 service.create" : "API-CONT-03 service.update",
          { type: "service", id: service.id },
          snapshot(existing ?? null),
          snapshot(service),
          t,
        );
        return { service };
      });
    },

    async deleteService(ctx: RequestContext, input: Id, tx?: DbOrTx): Promise<void> {
      return runInTx(tx, async (t) => {
        const [existing] = await t.delete(services).where(eq(services.id, input.id)).returning();
        if (existing === undefined) throw notFound("service");
        await deps.audit.log(
          ctx,
          "API-CONT-03 service.delete",
          { type: "service", id: existing.id },
          snapshot(existing),
          null,
          t,
        );
      });
    },

    async reorderServices(
      ctx: RequestContext,
      input: Reorder,
      tx?: DbOrTx,
    ): Promise<{ services: Service[] }> {
      return runInTx(tx, async (t) => {
        const all = await t.select().from(services);
        const order = applyOrder(all, input.ids);
        const now = deps.now();
        for (const { id, position } of order) {
          await t.update(services).set({ position, updatedAt: now }).where(eq(services.id, id));
        }
        const rows = await listAll(t);
        await deps.audit.log(
          ctx,
          "API-CONT-03 service.reorder",
          { type: "service", id: "*" },
          snapshot(all.map((r) => ({ id: r.id, position: r.position }))),
          snapshot(order),
          t,
        );
        return { services: rows };
      });
    },

    /** Admin read: every service (published or not) in position order. */
    listServicesAdmin(tx?: DbOrTx): Promise<Service[]> {
      return listAll(tx);
    },

    async listPublishedServices(tx?: DbOrTx): Promise<Service[]> {
      return reader(tx)
        .select()
        .from(services)
        .where(eq(services.published, true))
        .orderBy(asc(services.position), asc(services.createdAt));
    },

    async findServicesByIds(ids: readonly string[], tx?: DbOrTx): Promise<Service[]> {
      if (ids.length === 0) return [];
      return reader(tx).select().from(services).where(inArray(services.id, [...ids]));
    },
  };
}
