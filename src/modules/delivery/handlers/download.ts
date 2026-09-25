/**
 * `download` handler — D-604/D-606, BR-15 (PHASE-05 P5.2 matrix row 1).
 * Grant: `active`, nothing else. Revoke/suspend: automatic (links refused by the service).
 * Customer view: cap + files allowed by `update_policy`, hidden unless `active`.
 */
import { filterReleaseFiles } from "../update-policy";
import type { DeliveryHandler } from "../handler";
import { commonAdminActions, customerMayUse } from "./_shared";

export const downloadHandler: DeliveryHandler<"download"> = {
  type: "download",

  onGranted: () =>
    Promise.resolve({ status: "active", provisioningState: "n/a", taskIds: [], emails: [] }),

  onRevoked: () => Promise.resolve({ automatic: true }),

  customerView({ entitlement, releaseFiles }) {
    const files = customerMayUse(entitlement)
      ? filterReleaseFiles(releaseFiles, {
          updatePolicy: entitlement.updatePolicy,
          accessStartsAt: entitlement.accessStartsAt,
          accessEndsAt: entitlement.accessEndsAt,
        })
      : [];
    return {
      type: "download",
      downloads: {
        used: entitlement.downloadsUsed,
        cap: entitlement.downloadCap,
        files: files.map((f) => ({
          mediaId: f.mediaId,
          version: f.version,
          name: f.name,
          sizeBytes: f.sizeBytes,
          releasedAt: f.releasedAt.toISOString(),
          notes: f.notes,
        })),
      },
    };
  },

  adminActions(entitlement, openTasks) {
    return [
      {
        key: "reset_download_count",
        label: "Reset download count",
        apiId: "API-DEL-13",
        enabled: entitlement.status !== "revoked",
        ...(entitlement.status === "revoked" ? { disabledReason: "entitlement is revoked" } : {}),
      },
      ...commonAdminActions(entitlement, openTasks),
    ];
  },

  isFulfilled: (entitlement) => entitlement.status === "active",
};
