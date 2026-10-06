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

// Side-effect-only: each domain module below calls `approvalsService.registerApplyHandler`
// at its own top level. That registration only runs once the module is actually evaluated —
// in this serverless app, module graphs are bundled/loaded per route, so a handler registered
// by a module nothing on the approve/reject path happens to import is silently missing from
// this process's in-memory registry (confirmed live: approving an admin.user_change request
// threw "No apply handler registered for approval type: admin.user_change" because nothing in
// the approvals flow's own import graph touched src/modules/users/service.ts). Importing every
// handler-registering module here, directly alongside the action handlers that call
// `approvalsService.decide()`, guarantees the registry is fully populated before any of them
// can run, regardless of what else has or hasn't loaded in this instance.
import "@/modules/catalog/service";
import "@/modules/ownership/service";
import "@/modules/users/service";

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
