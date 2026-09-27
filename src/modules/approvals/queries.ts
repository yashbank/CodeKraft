"use server";

/**
 * Approvals read queries (docs/06 §2.7, API-ADM-01; PHASE-03 P3.2).
 * Uses defineAction with approvals.read permission.
 */
import { z } from "zod";
import { defineAction } from "@/lib/actions/envelope";
import { getApprovalInput, listApprovalsInput } from "./types";
import { approvalsService } from "./service";
import { getDb } from "@/lib/db";
import { listActiveAdminUsers, type AdminDirectoryEntry } from "./approver-set";

export const listApprovalsAction = defineAction({
  name: "API-ADM-01 approval.list",
  input: listApprovalsInput,
  permission: "approvals.read",
  handler: (input, ctx) => approvalsService.listApprovals(ctx, input),
});

export const getApprovalAction = defineAction({
  name: "API-ADM-01 approval.get",
  input: getApprovalInput,
  permission: "approvals.read",
  handler: (input, ctx) => approvalsService.getApproval(ctx, input),
});

/**
 * Admin-class directory (id/name/email/role), active users only — powers the requester/decision
 * name lookups on this screen. Gated by `approvals.read` since it is only ever fetched alongside
 * the approvals list; the leads and queries modules expose their own thin wrappers around the
 * same helper (see `src/modules/approvals/approver-set.ts`) gated by their own read permission.
 */
export const listAdminDirectoryQuery = defineAction({
  name: "admin.directory.list (approvals)",
  input: z.strictObject({}),
  permission: "approvals.read",
  handler: async (_input, ctx): Promise<{ items: AdminDirectoryEntry[] }> => {
    void ctx;
    return { items: await listActiveAdminUsers(getDb()) };
  },
});
