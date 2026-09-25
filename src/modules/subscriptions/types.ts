/**
 * Subscriptions — docs/06 §2.5 API-DEL-04 `renewSubscription`, DEL-05 `cancelSubscription`,
 * DEL-14 `cancelSubscriptionAdmin`; §3.3 `subscriptions.remind_grace_suspend`; §5.3 sequence;
 * BR-14, D-521, MASTER_SPEC §7 "Subscription grace" (7-day grace = `status='past_due'` while the
 * entitlement stays `active`; after grace both `suspended`) and "Renewal order expiry"
 * (`orders.expires_at = subscriptions.grace_until`).
 */
import { z } from "zod";
import { isoDateTime, SUBSCRIPTION_STATUSES, uuid } from "@/modules/entitlements/types";

export { SUBSCRIPTION_STATUSES };
export type { SubscriptionStatus, SubscriptionView } from "@/modules/entitlements/types";

export const BILLING_INTERVALS = ["monthly", "quarterly", "annual"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Manual methods only in release 1 (D-501). */
export const RENEWAL_PAYMENT_METHODS = ["manual_upi", "manual_bank"] as const;

/** Same shape as API-COM-02 `billing` (D-410); optional on renewal — defaults to the last order's snapshot. */
export const renewalBillingSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.email().max(254),
    country: z.string().trim().length(2).toUpperCase(),
    company: z.string().trim().max(120).optional(),
    address: z.string().trim().max(500).optional(),
    gstNumber: z.string().trim().max(15).optional(),
  })
  .strict();

/** API-DEL-04 `renewSubscription` — `commerce.self`; creates a `renewal` order at the current price. */
export const renewSubscriptionSchema = z
  .object({
    entitlementId: uuid,
    paymentMethod: z.enum(RENEWAL_PAYMENT_METHODS),
    billing: renewalBillingSchema.optional(),
  })
  .strict();
export type RenewSubscriptionInput = z.infer<typeof renewSubscriptionSchema>;

/** API-DEL-05 `cancelSubscription` — `delivery.self`; `cancel_at_period_end=true`, access to period end. */
export const cancelSubscriptionSchema = z
  .object({ entitlementId: uuid, reason: z.string().trim().max(500).optional() })
  .strict();
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;

/** API-DEL-14 `cancelSubscriptionAdmin` — `entitlements.admin`; reason mandatory (audited). */
export const cancelSubscriptionAdminSchema = z
  .object({
    entitlementId: uuid,
    reason: z.string().trim().min(1).max(500),
    /** `true` ends access now (entitlement `expired`), default keeps access to period end. */
    immediate: z.boolean().default(false),
  })
  .strict();
export type CancelSubscriptionAdminInput = z.infer<typeof cancelSubscriptionAdminSchema>;

/** API-DEL-04 output — the API-COM-02 shape for the renewal order (`instructions` typed by domain B). */
export interface RenewalOrderResult {
  orderId: string;
  orderNo: string;
  payment: {
    paymentId: string;
    method: (typeof RENEWAL_PAYMENT_METHODS)[number];
    instructions: Record<string, unknown>;
  };
  /** = `subscriptions.grace_until` (MASTER_SPEC §7 "Renewal order expiry"). */
  expiresAt: string;
  /** `true` when an existing `pending_payment` renewal order was returned instead (idempotent). */
  existing: boolean;
}

/** Full subscription row view for admin + customer results. */
export interface SubscriptionDetail {
  subscriptionId: string;
  entitlementId: string;
  interval: BillingInterval;
  status: (typeof SUBSCRIPTION_STATUSES)[number];
  currentPeriodStart: string;
  currentPeriodEnd: string;
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
  renewalOrderId: string | null;
  reminderSentAt: string | null;
}

/** `daily/subscriptions.remind_grace_suspend` detail. */
export interface RemindGraceSuspendDetail extends Record<string, unknown> {
  reminded7d: number;
  reminded1d: number;
  movedToPastDue: number;
  suspended: number;
  cancelled: number;
  /** `delivery_tasks(revoke_external)` opened by handlers on suspension (D-607). */
  revokeTasks: number;
}

export const subscriptionIsoDateTime = isoDateTime;
