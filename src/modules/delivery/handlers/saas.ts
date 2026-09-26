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
import type { EntitlementAdminAction, ProvisioningNotes } from "@/modules/entitlements/types";

export class SaasDeliveryHandler implements DeliveryHandler<"saas"> {
  readonly type = "saas" as const;

  async onGranted(
    _ctx: DeliveryHandlerContext,
    entitlement: Entitlement,
    tx: TxCtx,
  ): Promise<GrantOutcome> {
    // Manual SaaS lands active with provisioning_state='pending' and an open 'provision' task
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
    entitlement: Entitlement,
    _revocation: RevocationInput,
    tx: TxCtx,
  ): Promise<RevokeOutcome> {
    // SaaS with external account creates a revoke_external task
    const [task] = await tx
      .insert(deliveryTasks)
      .values({
        entitlementId: entitlement.id,
        kind: "revoke_external",
        status: "open",
      })
      .returning({ id: deliveryTasks.id });

    return {
      automatic: false,
      taskId: task?.id,
    };
  }

  customerView(source: CustomerViewSource): CustomerDeliveryView {
    return {
      type: "saas",
      provisioning: {
        state: source.entitlement.provisioningState,
        notes: (source.entitlement.provisioningNotes as ProvisioningNotes) ?? null,
      },
    };
  }

  adminActions(entitlement: Entitlement): EntitlementAdminAction[] {
    const isRevoked = entitlement.status === "revoked";
    const isPendingProv = entitlement.provisioningState === "pending";
    return [
      {
        key: "complete_provisioning",
        label: "Complete Provisioning",
        apiId: "API-DEL-07",
        enabled: !isRevoked && isPendingProv,
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
    return entitlement.provisioningState === "done";
  }
}

export const saasDeliveryHandler = new SaasDeliveryHandler();
