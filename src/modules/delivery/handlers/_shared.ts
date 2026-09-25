/**
 * Helpers shared by the six delivery handlers (PHASE-05 P5.2). Handlers stay thin: the only
 * I/O they perform is inserting `delivery_tasks` / `service_progress` rows through the
 * transaction they are handed.
 */
import type { TxCtx } from "@/lib/db";
import {
  type DeliveryTask,
  type Entitlement,
  deliveryTasks,
} from "../../../../drizzle/schema/delivery";
import type { EntitlementAdminAction } from "@/modules/entitlements/types";
import type { DeliveryTaskKind } from "../types";

/** Insert one open task and return its id. */
export async function openDeliveryTask(
  tx: TxCtx,
  entitlementId: string,
  kind: DeliveryTaskKind,
  note: string | null = null,
): Promise<string> {
  const [row] = await tx
    .insert(deliveryTasks)
    .values({ entitlementId, kind, status: "open", note })
    .returning({ id: deliveryTasks.id });
  if (row === undefined) throw new Error("delivery_tasks insert returned no row");
  return row.id;
}

export function hasOpenTask(openTasks: readonly DeliveryTask[], kind: DeliveryTaskKind): boolean {
  return openTasks.some((t) => t.kind === kind && t.status === "open");
}

/** Customer-facing secrets (files, keys, credentials) are hidden unless the row is `active` (docs/06 §5.3 step 5). */
export function customerMayUse(entitlement: Pick<Entitlement, "status">): boolean {
  return entitlement.status === "active";
}

export function isLive(entitlement: Pick<Entitlement, "status">): boolean {
  return entitlement.status !== "revoked" && entitlement.status !== "expired";
}

/** `extend_access` + `revoke` — every type offers these (SCR-ADM-12). */
export function commonAdminActions(
  entitlement: Pick<Entitlement, "status">,
  openTasks: readonly DeliveryTask[],
): EntitlementAdminAction[] {
  const live = isLive(entitlement);
  const revokePending = hasOpenTask(openTasks, "revoke_external");
  return [
    {
      key: "extend_access",
      label: "Extend access",
      apiId: "API-DEL-14",
      enabled: live,
      ...(live ? {} : { disabledReason: `entitlement is ${entitlement.status}` }),
    },
    {
      key: "revoke",
      label: "Revoke",
      apiId: "API-DEL-12",
      enabled: entitlement.status !== "revoked" && !revokePending,
      ...(entitlement.status === "revoked"
        ? { disabledReason: "already revoked" }
        : revokePending
          ? { disabledReason: "external revocation task open" }
          : {}),
    },
    ...(revokePending
      ? [
          {
            key: "complete_task" as const,
            label: "Complete revocation task",
            apiId: "API-DEL-10",
            enabled: true,
          },
        ]
      : []),
  ];
}
