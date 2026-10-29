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

export class CustomDeliveryHandler implements DeliveryHandler<"custom"> {
  readonly type = "custom" as const;

  async onGranted(
    _ctx: DeliveryHandlerContext,
    entitlement: Entitlement,
    tx: TxCtx,
  ): Promise<GrantOutcome> {
    // Custom work is hand-delivered: pending + an open 'provision' task until an admin marks it
    // delivered, otherwise the order would read "fulfilled" the moment it is paid.
    const [task] = await tx
      .insert(deliveryTasks)
      .values({ entitlementId: entitlement.id, kind: "provision", status: "open" })
      .returning({ id: deliveryTasks.id });
    return {
      status: "pending",
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
    const notes = source.entitlement.provisioningNotes as {
      message?: string;
      loginUrl?: string;
    } | null;
    const statusNote = [notes?.message, notes?.loginUrl].filter(Boolean).join("\n") || null;
    return {
      type: "custom",
      custom: {
        attachments: [],
        statusNote,
      },
    };
  }

  adminActions(entitlement: Entitlement): EntitlementAdminAction[] {
    const isRevoked = entitlement.status === "revoked";
    return [
      {
        key: "complete_provisioning",
        label: "Mark delivered",
        apiId: "API-DEL-07",
        enabled: !isRevoked && entitlement.provisioningState === "pending",
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
    // 'n/a' = legacy rows granted before custom orders needed a delivery step.
    return entitlement.provisioningState !== "pending" && entitlement.status === "active";
  }
}

export const customDeliveryHandler = new CustomDeliveryHandler();
