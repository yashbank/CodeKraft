/**
 * `approvals` read models (docs/06 §2.7 API-ADM-01): `listApprovals` / `getApproval`. Read-only,
 * never audited (MASTER_SPEC §4.9). Both are `defineAction` reads with `approvals.read`.
 */
import { defineAction } from "@/lib/actions/envelope";
import { approvalsService } from "./service";
import { getApprovalInput, listApprovalsInput } from "./types";

/** API-ADM-01 `listApprovals` — filters `status, type, requestedBy, mine`; sort `createdAt`. */
export const listApprovals = defineAction({
  name: "API-ADM-01 approval.list",
  input: listApprovalsInput,
  permission: "approvals.read",
  handler: (input, ctx) => approvalsService.listApprovals(ctx, input),
});

/** API-ADM-01 `getApproval` — full view with `decisions[]`, `pendingApprovers[]`, `ageHours`. */
export const getApproval = defineAction({
  name: "API-ADM-01 approval.get",
  input: getApprovalInput,
  permission: "approvals.read",
  handler: (input, ctx) => approvalsService.getApproval(ctx, input),
});
