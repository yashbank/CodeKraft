/**
 * `service` handler — D-608 checklist (PHASE-05 P5.2 matrix row 5).
 * Grant: `active` + one `service_progress` row per `offerings.service_steps` entry.
 * Fulfilled when every step has `done_at`. Revoke/suspend: automatic.
 */
import { serviceProgress } from "../../../../drizzle/schema/delivery";
import type { ServiceStep } from "../../../../drizzle/schema/offerings";
import type { DeliveryHandler } from "../handler";
import { commonAdminActions, isLive } from "./_shared";

export function stepsFromOffering(steps: ServiceStep[] | null): ServiceStep[] {
  if (steps === null) return [];
  const seen = new Set<string>();
  return steps.filter((s) => {
    if (typeof s.key !== "string" || s.key.length === 0 || seen.has(s.key)) return false;
    seen.add(s.key);
    return true;
  });
}

export const serviceHandler: DeliveryHandler<"service"> = {
  type: "service",

  async onGranted(ctx, entitlement, tx) {
    const steps = stepsFromOffering(ctx.offering.serviceSteps);
    if (steps.length > 0) {
      await tx
        .insert(serviceProgress)
        .values(steps.map((s) => ({ entitlementId: entitlement.id, stepKey: s.key })))
        .onConflictDoNothing();
    }
    return { status: "active", provisioningState: "n/a", taskIds: [], emails: [] };
  },

  onRevoked: () => Promise.resolve({ automatic: true }),

  customerView({ entitlement, ctx, serviceProgress: progress }) {
    const steps = stepsFromOffering(ctx.offering.serviceSteps);
    const byKey = new Map(progress.map((p) => [p.stepKey, p]));
    const rows = steps.map((s) => ({
      key: s.key,
      title: s.title,
      description: s.description ?? null,
      doneAt: byKey.get(s.key)?.doneAt?.toISOString() ?? null,
    }));
    // Progress rows without a matching step definition (offering edited later) still show.
    for (const p of progress) {
      if (!steps.some((s) => s.key === p.stepKey)) {
        rows.push({ key: p.stepKey, title: p.stepKey, description: null, doneAt: p.doneAt?.toISOString() ?? null });
      }
    }
    return {
      type: "service",
      serviceProgress: rows,
      fulfilled: serviceHandler.isFulfilled(entitlement, progress),
    };
  },

  adminActions(entitlement, openTasks) {
    const live = isLive(entitlement);
    return [
      {
        key: "mark_service_step",
        label: "Mark service step",
        apiId: "API-DEL-09",
        enabled: live,
        ...(live ? {} : { disabledReason: `entitlement is ${entitlement.status}` }),
      },
      ...commonAdminActions(entitlement, openTasks),
    ];
  },

  isFulfilled: (entitlement, progress) =>
    entitlement.status === "active" && progress.every((p) => p.doneAt !== null),
};
