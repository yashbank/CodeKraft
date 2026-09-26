import type { TxCtx } from "@/lib/db";
import { serviceProgress, type Entitlement } from "../../../../drizzle/schema/delivery";
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

export class ServiceDeliveryHandler implements DeliveryHandler<"service"> {
  readonly type = "service" as const;

  async onGranted(
    ctx: DeliveryHandlerContext,
    entitlement: Entitlement,
    tx: TxCtx,
  ): Promise<GrantOutcome> {
    // Populate service_progress rows from offering.serviceSteps
    const steps = ctx.offering.serviceSteps ?? [];
    if (steps.length > 0) {
      await tx.insert(serviceProgress).values(
        steps.map((step) => ({
          entitlementId: entitlement.id,
          stepKey: step.key,
          doneAt: null,
          doneBy: null,
          note: null,
        })),
      );
    }

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
    const steps = source.ctx.offering.serviceSteps ?? [];
    const stepMap = new Map(source.serviceProgress.map((sp) => [sp.stepKey, sp]));

    const progressItems = steps.map((step) => {
      const sp = stepMap.get(step.key);
      return {
        key: step.key,
        title: step.title,
        description: step.description ?? null,
        doneAt: sp?.doneAt ? sp.doneAt.toISOString() : null,
      };
    });

    const fulfilled =
      steps.length > 0 && steps.every((s) => Boolean(stepMap.get(s.key)?.doneAt));

    return {
      type: "service",
      serviceProgress: progressItems,
      fulfilled,
    };
  }

  adminActions(entitlement: Entitlement): EntitlementAdminAction[] {
    const isRevoked = entitlement.status === "revoked";
    return [
      {
        key: "mark_service_step",
        label: "Mark Service Step",
        apiId: "API-DEL-09",
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

  isFulfilled(_entitlement: Entitlement, progress: typeof serviceProgress.$inferSelect[]): boolean {
    if (progress.length === 0) return true;
    return progress.every((p) => p.doneAt !== null);
  }
}

export const serviceDeliveryHandler = new ServiceDeliveryHandler();
