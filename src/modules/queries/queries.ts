"use server";

/**
 * `queries` read-only queries — owned by P6 (master plan §3 ownership map). `queriesService` is
 * fully implemented (see `service.ts`); this file adds the `defineAction` wrappers P2.8 left
 * empty, following `finance/queries.ts` / `approvals/queries.ts`.
 */
import { z } from "zod";
import { defineAction } from "@/lib/actions/envelope";
import {
  getMyQuerySchema,
  getQueryAdminSchema,
  listMyQueriesSchema,
  listQueriesAdminSchema,
} from "./types";
import { queriesService } from "./service";
import { getDb } from "@/lib/db";
import { listActiveAdminUsers, type AdminDirectoryEntry } from "@/modules/approvals/approver-set";

export const listQueriesAdminQuery = defineAction({
  name: "API-CHAT-04 listQueriesAdmin",
  input: listQueriesAdminSchema,
  permission: "queries.read",
  handler: (input, ctx) => queriesService.listQueriesAdmin(ctx, input),
});

export const getQueryAdminQuery = defineAction({
  name: "API-CHAT-04 getQueryAdmin",
  input: getQueryAdminSchema,
  permission: "queries.read",
  handler: (input, ctx) => queriesService.getQueryAdmin(ctx, input),
});

/**
 * Admin-class directory for the assignee picker — gated by `queries.read`, same pattern as
 * `leads/queries.ts`'s `listAssignableAdminsQuery` (see `approvals/approver-set.ts`).
 */
export const listAssignableAdminsQuery = defineAction({
  name: "admin.directory.list (queries)",
  input: z.strictObject({}),
  permission: "queries.read",
  handler: async (_input, ctx): Promise<{ items: AdminDirectoryEntry[] }> => {
    void ctx;
    return { items: await listActiveAdminUsers(getDb()) };
  },
});

/** API-CHAT-02 `listMyQueries` — `support.self`, own rows only (service filters by `ctx.userId`). */
export const listMyQueriesQuery = defineAction({
  name: "API-CHAT-02 query.list_mine",
  input: listMyQueriesSchema,
  permission: "support.self",
  handler: (input, ctx) => queriesService.listMyQueries(ctx, input),
});

/**
 * API-CHAT-02 `getMyQuery` — `support.self`, own thread only. Backs `/account/queries/[id]`
 * (BUG-007): the list screen already links to `${links.query}/${q.id}`, but no action or route
 * ever called `queriesService.getMyQuery` (fully implemented, just unwired).
 */
export const getMyQueryQuery = defineAction({
  name: "API-CHAT-02 query.get_mine",
  input: getMyQuerySchema,
  permission: "support.self",
  handler: (input, ctx) => queriesService.getMyQuery(ctx, input),
});
