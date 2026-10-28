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

export class CustomDeliveryHandler implements DeliveryHandler<"custom"> {
  readonly type = "custom" as const;

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

export const customDeliveryHandler = new CustomDeliveryHandler();
