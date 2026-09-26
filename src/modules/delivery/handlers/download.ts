import type { TxCtx } from "@/lib/db";
import type { Entitlement } from "../../../../drizzle/schema/delivery";
import type {
  CustomerDeliveryView,
  CustomerViewSource,
  DeliveryHandler,
  DeliveryHandlerContext,
  GrantOutcome,
  RevocationInput,
  RevokeOutcome,
} from "../handler";
import type { EntitlementAdminAction } from "@/modules/entitlements/types";

export class DownloadDeliveryHandler implements DeliveryHandler<"download"> {
  readonly type = "download" as const;

  async onGranted(
    _ctx: DeliveryHandlerContext,
    _entitlement: Entitlement,
    _tx: TxCtx,
  ): Promise<GrantOutcome> {
    return {
      status: "active",
      provisioningState: "n/a",
      taskIds: [],
      emails: [],
    };
  }

  async onRevoked(
    _ctx: DeliveryHandlerContext,
    _entitlement: Entitlement,
    _revocation: RevocationInput,
    _tx: TxCtx,
  ): Promise<RevokeOutcome> {
    return {
      automatic: true,
    };
  }

  customerView(source: CustomerViewSource): CustomerDeliveryView {
    const isSuspendedOrRevoked =
      source.entitlement.status === "suspended" ||
      source.entitlement.status === "expired" ||
      source.entitlement.status === "revoked";

    const files = isSuspendedOrRevoked
      ? []
      : source.releaseFiles.map((rf) => ({
          mediaId: rf.mediaId,
          version: rf.version,
          name: rf.name,
          sizeBytes: rf.sizeBytes,
          releasedAt: rf.releasedAt.toISOString(),
          notes: rf.notes,
        }));

    return {
      type: "download",
      downloads: {
        used: source.entitlement.downloadsUsed,
        cap: source.entitlement.downloadCap,
        files,
      },
    };
  }

  adminActions(entitlement: Entitlement): EntitlementAdminAction[] {
    const isRevoked = entitlement.status === "revoked";
    return [
      {
        key: "reset_download_count",
        label: "Reset Download Count",
        apiId: "API-DEL-13",
        enabled: !isRevoked,
      },
      {
        key: "extend_access",
        label: "Extend Access",
        apiId: "API-DEL-14",
        enabled: !isRevoked,
      },
      {
        key: "revoke",
        label: "Revoke Access",
        apiId: "API-DEL-12",
        enabled: !isRevoked,
      },
    ];
  }

  isFulfilled(entitlement: Entitlement): boolean {
    return entitlement.status === "active";
  }
}

export const downloadDeliveryHandler = new DownloadDeliveryHandler();
