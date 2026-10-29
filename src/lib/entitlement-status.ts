import { formatDate } from "@/components/account/format";
import type { Tone } from "@/lib/status-tone";

export type EntitlementPhase =
  "awaiting" | "provisioning" | "active" | "suspended" | "expired" | "revoked" | "refunded";

export interface EntitlementStatusInput {
  status: "pending" | "active" | "suspended" | "expired" | "revoked";
  /** "pending" = admin still has to grant/fulfil; "done"/"n/a" = nothing outstanding. */
  provisioningState: "n/a" | "pending" | "done";
  /** ISO. Service start = access start. */
  startsAt?: string | null;
  /** ISO. Entitlement end; null = lifetime. */
  endsAt?: string | null;
  /** Subscription period end wins over `endsAt` (renewals move the period first). */
  subscriptionPeriodEnd?: string | null;
  /** Revoked by a full refund (revoke_reason = "refund"). */
  refunded?: boolean;
}

export interface EntitlementStatusLabel {
  phase: EntitlementPhase;
  /** Short chip text. */
  chip: string;
  /** Full status line. */
  label: string;
  tone: Tone;
}

/**
 * The ONE place that turns an entitlement row into customer/admin-facing status text. Lifecycle:
 * paid -> Provisioning -> (admin fulfils) -> Active — service started D, expires E | No expiry
 * -> Expired / Revoked / Refunded. Every delivery type goes through the same states because the
 * handlers all express fulfilment as `provisioningState` + `status`.
 */
export function entitlementStatus(i: EntitlementStatusInput): EntitlementStatusLabel {
  const end = i.subscriptionPeriodEnd ?? i.endsAt ?? null;
  const endText = end ? formatDate(end) : null;
  if (i.refunded) {
    return { phase: "refunded", chip: "Refunded", label: "Refunded", tone: "neutral" };
  }
  if (i.status === "revoked") {
    return { phase: "revoked", chip: "Revoked", label: "Access revoked", tone: "danger" };
  }
  if (i.status === "expired") {
    return {
      phase: "expired",
      chip: "Expired",
      label: endText ? `Expired on ${endText}` : "Expired",
      tone: "ghost",
    };
  }
  if (i.status === "suspended") {
    return {
      phase: "suspended",
      chip: "Suspended",
      label: "Suspended — payment overdue",
      tone: "warning",
    };
  }
  if (i.provisioningState === "pending") {
    return {
      phase: "provisioning",
      chip: "Provisioning",
      label: "Provisioning — we are setting this up",
      tone: "warning",
    };
  }
  if (i.status === "pending") {
    return { phase: "awaiting", chip: "Pending", label: "Pending", tone: "warning" };
  }
  const started = i.startsAt ? `service started ${formatDate(i.startsAt)}, ` : "";
  return {
    phase: "active",
    chip: "Active",
    label: `Active — ${started}${endText ? `expires ${endText}` : "no expiry"}`,
    tone: "success",
  };
}
