/**
 * `custom` handler — instructions only (PHASE-05 P5.2 matrix row 6).
 * Grant: `active`, `provisioning_state='pending'` (no task): the admin marks delivery done with
 * `completeProvisioning` (API-DEL-07 semantics, docs/06 §5.1 step 6), which fulfils the order.
 */
import type { DeliveryHandler } from "../handler";
import { commonAdminActions, customerMayUse } from "./_shared";
import { parseProvisioningNotes } from "./provisioned";

export const customHandler: DeliveryHandler<"custom"> = {
  type: "custom",

  onGranted: () =>
    Promise.resolve({ status: "active", provisioningState: "pending", taskIds: [], emails: [] }),

  onRevoked: () => Promise.resolve({ automatic: true }),

  customerView({ entitlement }) {
    const notes = customerMayUse(entitlement) ? parseProvisioningNotes(entitlement.provisioningNotes) : null;
    return {
      type: "custom",
      custom: { attachments: [], statusNote: notes?.message ?? null },
    };
  },

  adminActions(entitlement, openTasks) {
    const pending = entitlement.provisioningState === "pending";
    const live = entitlement.status !== "revoked" && entitlement.status !== "expired";
    return [
      {
        key: "complete_provisioning",
        label: "Mark delivered",
        apiId: "API-DEL-07",
        enabled: pending && live,
        ...(pending && live
          ? {}
          : { disabledReason: pending ? `entitlement is ${entitlement.status}` : "already delivered" }),
      },
      ...commonAdminActions(entitlement, openTasks),
    ];
  },

  isFulfilled: (entitlement) =>
    entitlement.status === "active" && entitlement.provisioningState === "done",
};
