import { AppError, ErrorCode } from "@/lib/errors";
import type { EntitlementStatus } from "./types";

/**
 * State machine for entitlements (docs/03 §3.4, MASTER_SPEC §7):
 * - pending → active
 * - active → suspended | expired | revoked
 * - suspended → active | revoked
 * - expired → revoked
 */
const VALID_TRANSITIONS: Record<EntitlementStatus, readonly EntitlementStatus[]> = {
  pending: ["active", "revoked"],
  active: ["suspended", "expired", "revoked"],
  suspended: ["active", "revoked"],
  expired: ["revoked"],
  revoked: [],
};

export function canTransitionEntitlement(
  from: EntitlementStatus,
  to: EntitlementStatus,
): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertValidEntitlementTransition(
  from: EntitlementStatus,
  to: EntitlementStatus,
): void {
  if (!canTransitionEntitlement(from, to)) {
    throw new AppError(
      ErrorCode.STATE_INVALID,
      `Cannot transition entitlement from '${from}' to '${to}'`,
    );
  }
}
