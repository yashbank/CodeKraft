/**
 * Entitlement state machine — docs/03 §3.4, D-605, PHASE-05 P5.1.
 *
 *   pending   → active | revoked        (manual `hosted` until `completeProvisioning`; refund before provisioning)
 *   active    → suspended | expired | revoked
 *   suspended → active | revoked        (subscription grace → suspend → renewal re-activates, D-1004)
 *   expired   → revoked
 *   revoked   → (terminal)
 *
 * Pure: no I/O. Services call `assertTransition` before every status write and additionally guard
 * the UPDATE with `where status = <from>` so concurrent writers cannot double-apply a transition.
 */
import { AppError, ErrorCode } from "@/lib/errors";
import type { EntitlementStatus } from "./types";

export const ENTITLEMENT_TRANSITIONS: Readonly<
  Record<EntitlementStatus, readonly EntitlementStatus[]>
> = Object.freeze({
  pending: ["active", "revoked"],
  active: ["suspended", "expired", "revoked"],
  suspended: ["active", "revoked"],
  expired: ["revoked"],
  revoked: [],
});

/** Statuses under which the customer may use the entitlement (downloads, key reveal). */
export const USABLE_STATUSES: readonly EntitlementStatus[] = ["active"];

/** Statuses that count as "owned" for the one-time duplicate-purchase guard (BR-10, API-DEL-11). */
export const OWNED_STATUSES: readonly EntitlementStatus[] = ["pending", "active", "suspended"];

export function canTransition(from: EntitlementStatus, to: EntitlementStatus): boolean {
  return ENTITLEMENT_TRANSITIONS[from].includes(to);
}

/** Throws `STATE_INVALID` (docs/06 §1.4) when `from → to` is not an allowed transition. */
export function assertTransition(from: EntitlementStatus, to: EntitlementStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(
      ErrorCode.STATE_INVALID,
      `Entitlement cannot move from '${from}' to '${to}'.`,
      { cause: { from, to } },
    );
  }
}

export function isTerminal(status: EntitlementStatus): boolean {
  return ENTITLEMENT_TRANSITIONS[status].length === 0;
}
