/**
 * Shared behaviour of the `saas` and `hosted` handlers — D-601 (manual provisioning), D-607
 * (external revocation task), MASTER_SPEC §7 "Order fulfilled" (PHASE-05 P5.2 matrix rows 3–4).
 *
 *  - Grant: `provisioning='manual'` (default) → `provisioning_state='pending'` + open `provision`
 *    task; `saas` is `active` at once, `hosted` stays `pending` until `completeProvisioning`.
 *    `provisioning='automated'` is refused with `STATE_INVALID` unless the `automated_provisioning`
 *    flag is on (R1 has no automated provisioner; with the flag it falls back to the manual task).
 *  - Revoke: an external account exists once provisioning is `done` → open `revoke_external`
 *    (hard and soft); before that access is cut automatically.
 *  - Fulfilled: `active` and `provisioning_state='done'`.
 */
import { AppError, ErrorCode } from "@/lib/errors";
import { getFlag } from "@/lib/feature-flags";
import type { DeliveryType, ProvisioningNotes } from "@/modules/entitlements/types";
import { provisioningNotesSchema } from "@/modules/entitlements/types";
import type { DeliveryHandler, GrantOutcome } from "../handler";
import { commonAdminActions, customerMayUse, openDeliveryTask } from "./_shared";

export function parseProvisioningNotes(raw: unknown): ProvisioningNotes | null {
  if (raw === null || raw === undefined) return null;
  const parsed = provisioningNotesSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function createProvisionedHandler<T extends Extract<DeliveryType, "saas" | "hosted">>(
  type: T,
  initialStatus: GrantOutcome["status"],
): DeliveryHandler<T> {
  return {
    type,

    async onGranted(ctx, entitlement, tx) {
      const mode = ctx.offering.deliveryConfig.provisioning ?? "manual";
      if (mode === "automated" && !(await getFlag("automated_provisioning"))) {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "Automated provisioning is not enabled; configure the offering for manual provisioning.",
        );
      }
      const taskId = await openDeliveryTask(
        tx,
        entitlement.id,
        "provision",
        `Provision ${type} access for ${ctx.customer.email}`,
      );
      return { status: initialStatus, provisioningState: "pending", taskIds: [taskId], emails: [] };
    },

    async onRevoked(ctx, entitlement, revocation, tx) {
      if (entitlement.provisioningState !== "done") return { automatic: true };
      const taskId = await openDeliveryTask(
        tx,
        entitlement.id,
        "revoke_external",
        `${revocation.mode === "soft" ? "Suspend" : "Revoke"} external ${type} account for ${ctx.customer.email}` +
          (revocation.reason === null ? "" : ` (${revocation.reason})`),
      );
      return { automatic: false, taskId };
    },

    customerView({ entitlement }) {
      return {
        type,
        provisioning: {
          state: entitlement.provisioningState,
          notes:
            customerMayUse(entitlement) && entitlement.provisioningState === "done"
              ? parseProvisioningNotes(entitlement.provisioningNotes)
              : null,
        },
      };
    },

    adminActions(entitlement, openTasks) {
      const pending = entitlement.provisioningState === "pending";
      const live = entitlement.status !== "revoked" && entitlement.status !== "expired";
      return [
        {
          key: "complete_provisioning",
          label: "Complete provisioning",
          apiId: "API-DEL-07",
          enabled: pending && live,
          ...(pending && live
            ? {}
            : { disabledReason: pending ? `entitlement is ${entitlement.status}` : "already provisioned" }),
        },
        ...commonAdminActions(entitlement, openTasks),
      ];
    },

    isFulfilled: (entitlement) =>
      entitlement.status === "active" && entitlement.provisioningState === "done",
  };
}
