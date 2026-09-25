/**
 * `approvals` Server Actions (docs/06 §2.7 API-ADM-02..04). Every export is a `defineAction`
 * (SA-07): Zod input from `./types`, permission asserted after the parse, the service runs in one
 * transaction with its audit row. Reads live in `./queries.ts`.
 */
import { defineAction } from "@/lib/actions/envelope";
import { approvalsService } from "./service";
import { approveRequestInput, cancelRequestInput, rejectRequestInput, retryApplyInput } from "./types";

/** API-ADM-02 — `approvals.decide` (`never_own_requests` is enforced by the service + DB trigger). */
export const approveRequest = defineAction({
  name: "API-ADM-02 approval.approve",
  input: approveRequestInput,
  permission: "approvals.decide",
  handler: (input, ctx) => approvalsService.approveRequest(ctx, input),
});

/** API-ADM-03 — `approvals.decide`; comment required. */
export const rejectRequest = defineAction({
  name: "API-ADM-03 approval.reject",
  input: rejectRequestInput,
  permission: "approvals.decide",
  handler: (input, ctx) => approvalsService.rejectRequest(ctx, input),
});

/** API-ADM-04 — requester only, while `pending` (any admin-class session; ownership checked by the service). */
export const cancelRequest = defineAction({
  name: "API-ADM-04 approval.cancel",
  input: cancelRequestInput,
  permission: "approvals.read",
  handler: (input, ctx) => approvalsService.cancelRequest(ctx, input),
});

/** API-ADM-04 — `super_admin` re-runs `execute()` for an `approved` request with `error`. */
export const retryApply = defineAction({
  name: "API-ADM-04 approval.retry",
  input: retryApplyInput,
  permission: "approvals.decide",
  handler: (input, ctx) => approvalsService.retryApply(ctx, input),
});
