import type { TxCtx } from "@/lib/db";
import { deliveryTasks, type Entitlement } from "../../../../drizzle/schema/delivery";
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

export class LicenseDeliveryHandler implements DeliveryHandler<"license"> {
  readonly type = "license" as const;

  async onGranted(
    _ctx: DeliveryHandlerContext,
    entitlement: Entitlement,
    tx: TxCtx,
  ): Promise<GrantOutcome> {
    // License lands in active status with provisioning_state='pending' and an open 'provision' task
    const [task] = await tx
      .insert(deliveryTasks)
      .values({
        entitlementId: entitlement.id,
        kind: "provision",
        status: "open",
      })
      .returning({ id: deliveryTasks.id });

    return {
      status: "active",
      provisioningState: "pending",
      taskIds: task ? [task.id] : [],
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

    const keyIssued = Boolean(source.entitlement.licenseKeyEnc);

    // Masked view: •••• •••• •••• 4F2A or null
    let licenseKeyMasked: string | null = null;
    if (!isSuspendedOrRevoked && keyIssued) {
      licenseKeyMasked = "•••• •••• •••• XXXX";
    }

    return {
      type: "license",
      licenseKeyMasked,
      keyIssued,
    };
  }

  adminActions(entitlement: Entitlement): EntitlementAdminAction[] {
    const isRevoked = entitlement.status === "revoked";
    return [
      {
        key: "set_license_key",
        label: "Set License Key",
        apiId: "API-DEL-08",
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
    return Boolean(entitlement.licenseKeyEnc);
  }
}

export const licenseDeliveryHandler = new LicenseDeliveryHandler();
