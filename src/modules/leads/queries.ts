"use server";

/**
 * `leads` read-only queries — owned by P6 (master plan §3 ownership map). `leadsService` is
 * fully implemented (see `service.ts`); this file only adds the `defineAction` wrappers that
 * P2.8 left empty (SA-07 governs `actions.ts`, not this file, but the same envelope convention
 * is followed for consistency with `finance/queries.ts` / `approvals/queries.ts`).
 */
import { z } from "zod";
import { defineAction } from "@/lib/actions/envelope";
import { getLeadSchema, listLeadsSchema } from "./types";
import { leadsService } from "./service";
import { getDb } from "@/lib/db";
import { listActiveAdminUsers, type AdminDirectoryEntry } from "@/modules/approvals/approver-set";

export const listLeadsQuery = defineAction({
  name: "API-LEAD-03 listLeads",
  input: listLeadsSchema,
  permission: "leads.read",
  handler: (input, ctx) => leadsService.listLeads(ctx, input),
});

export const getLeadQuery = defineAction({
  name: "API-LEAD-03 getLead",
  input: getLeadSchema,
  permission: "leads.read",
  handler: (input, ctx) => leadsService.getLead(ctx, input),
});

/**
 * Admin-class directory for the assignee picker (claim / assign / bulk-assign) and for resolving
 * `LeadRow.assignedTo`/`LeadActivityRow.actor` display names — gated by `leads.read` since it is
 * only ever fetched alongside the leads list on this screen. See
 * `src/modules/approvals/approver-set.ts` for why this lives there rather than being duplicated.
 */
export const listAssignableAdminsQuery = defineAction({
  name: "admin.directory.list (leads)",
  input: z.strictObject({}),
  permission: "leads.read",
  handler: async (_input, ctx): Promise<{ items: AdminDirectoryEntry[] }> => {
    void ctx;
    return { items: await listActiveAdminUsers(getDb()) };
  },
});
