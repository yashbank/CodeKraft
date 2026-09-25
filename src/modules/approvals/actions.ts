"use server";

/**
 * Approvals Server Actions (docs/06 §2.7, API-ADM-02..04; PHASE-03 P3.2).
 * Uses defineAction (SA-07).
 */
import { defineAction } from "@/lib/actions/envelope";
import {
  approveRequestInput,
  cancelRequestInput,
  rejectRequestInput,
  retryApplyInput,
} from "./types";
import { approvalsService } from "./service";

export const approveRequestAction = defineAction({
  name: "API-ADM-02 approval.approve",
  input: approveRequestInput,
  permission: "approvals.decide",
  handler: (input, ctx) => approvalsService.approveRequest(ctx, input),
});

export const rejectRequestAction = defineAction({
  name: "API-ADM-03 approval.reject",
  input: rejectRequestInput,
  permission: "approvals.decide",
  handler: (input, ctx) => approvalsService.rejectRequest(ctx, input),
});

export const cancelRequestAction = defineAction({
  name: "API-ADM-04 approval.cancel",
  input: cancelRequestInput,
  handler: (input, ctx) => approvalsService.cancelRequest(ctx, input),
});

export const retryApplyAction = defineAction({
  name: "API-ADM-04 approval.retry_apply",
  input: retryApplyInput,
  permission: "approvals.decide",
  handler: (input, ctx) => approvalsService.retryApply(ctx, input),
});
