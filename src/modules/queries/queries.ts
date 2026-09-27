"use server";

/**
 * `queries` read-only queries — owned by P6 (master plan §3 ownership map). `queriesService` is
 * fully implemented (see `service.ts`); this file adds the `defineAction` wrappers P2.8 left
 * empty, following `finance/queries.ts` / `approvals/queries.ts`.
 */
import { z } from "zod";
import { defineAction } from "@/lib/actions/envelope";
import { getQueryAdminSchema, listQueriesAdminSchema } from "./types";
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
