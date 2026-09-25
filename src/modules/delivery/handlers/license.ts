/**
 * `license` handler — D-603, TM-05 (PHASE-05 P5.2 matrix row 2).
 * Grant: `active` with `provisioning_state='pending'` and an open `provision` task (the admin
 * must enter the key, API-DEL-08). Fulfilled once the key is set. Revoke/suspend: automatic
 * (the key is hidden). The customer view carries only the masked key.
 */
import { maskedFromEncrypted } from "../license";
import type { DeliveryHandler } from "../handler";
import { commonAdminActions, customerMayUse, isLive, openDeliveryTask } from "./_shared";

export const licenseHandler: DeliveryHandler<"license"> = {
  type: "license",

  async onGranted(_ctx, entitlement, tx) {
    const taskId = await openDeliveryTask(tx, entitlement.id, "provision", "Enter the license key");
    return { status: "active", provisioningState: "pending", taskIds: [taskId], emails: [] };
  },

  onRevoked: () => Promise.resolve({ automatic: true }),

  customerView({ entitlement }) {
    const keyIssued = entitlement.licenseKeyEnc !== null && entitlement.licenseKeyEnc !== "";
    return {
      type: "license",
      keyIssued,
      licenseKeyMasked:
        keyIssued && customerMayUse(entitlement) ? maskedFromEncrypted(entitlement.licenseKeyEnc) : null,
    };
  },

  adminActions(entitlement, openTasks) {
    const live = isLive(entitlement);
    return [
      {
        key: "set_license_key",
        label: entitlement.licenseKeyEnc === null ? "Set license key" : "Replace license key",
        apiId: "API-DEL-08",
        enabled: live,
        ...(live ? {} : { disabledReason: `entitlement is ${entitlement.status}` }),
      },
      ...commonAdminActions(entitlement, openTasks),
    ];
  },

  isFulfilled: (entitlement) =>
    entitlement.status === "active" &&
    entitlement.licenseKeyEnc !== null &&
    entitlement.licenseKeyEnc !== "",
};
