import { AppError } from "@/lib/errors";
import type { LeadStatus } from "./types";

const VALID_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ["contacted", "qualified", "lost"],
  contacted: ["qualified", "proposal", "lost"],
  qualified: ["proposal", "won", "lost"],
  proposal: ["won", "lost"],
  won: [],
  lost: ["new"], // reopen
};

export function canTransitionLeadStatus(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidLeadStatusTransition(
  from: LeadStatus,
  to: LeadStatus,
  lostReason?: string | null,
  wonOrderId?: string | null,
): void {
  if (from === to) return;

  if (!canTransitionLeadStatus(from, to)) {
    throw new AppError(
      "STATE_INVALID",
      `Invalid lead status transition from '${from}' to '${to}'`,
    );
  }

  if (to === "lost") {
    if (!lostReason || lostReason.trim().length === 0) {
      throw new AppError("VALIDATION", "lostReason is required when marking lead as lost");
    }
  }

  if (to === "won" && !wonOrderId) {
    // Note: wonOrderId can be linked upon winning or created with order
  }
}
