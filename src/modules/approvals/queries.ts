"use server";

/**
 * Approvals read queries (docs/06 §2.7, API-ADM-01; PHASE-03 P3.2).
 * Uses defineAction with approvals.read permission.
 */
import { defineAction } from "@/lib/actions/envelope";
import { getApprovalInput, listApprovalsInput } from "./types";
import { approvalsService } from "./service";

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
