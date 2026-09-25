/**
 * Subscriptions service contract — docs/06 §2.5 API-DEL-04/05/14, §3.3 cron, §5.3 sequence,
 * BR-14, D-521, D-1004, MASTER_SPEC §7 "Subscription grace" / "Renewal order expiry".
 * Implementation in P5.
 */
import type { RequestContext } from "@/lib/authz/context";
import type { TxCtx } from "@/lib/db";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";
import type {
  CancelSubscriptionAdminInput,
  CancelSubscriptionInput,
  RemindGraceSuspendDetail,
  RenewSubscriptionInput,
  RenewalOrderResult,
  SubscriptionDetail,
} from "./types";

export interface SubscriptionsService {
  /**
   * API-DEL-04 `renewSubscription` — `commerce.self` + verified email, rate class `checkout`.
   * Creates `orders(type='renewal', expires_at = subscriptions.grace_until)` with one item for
   * the same offering at the current price and sets `subscriptions.renewal_order_id`.
   * `STATE_INVALID` when cancelled; an existing `pending_payment` renewal order is returned
   * (`existing=true`) instead of creating a second. `DUPLICATE_PURCHASE` never applies.
   */
  renew(ctx: RequestContext, input: RenewSubscriptionInput): Promise<RenewalOrderResult>;

  /**
   * Called by `payments.confirm` (API-PAY-03) via `entitlements.grantForOrder` for a `renewal`
   * order, inside the caller's transaction: extends `current_period_start/end` by the interval
   * from the previous `period_end` (or from now when confirmed after suspension), `status='active'`,
   * clears `grace_until`, re-activates a `suspended` entitlement (docs/06 §5.3 step 3, D-1004).
   */
  onRenewalPaid(orderId: string, tx: TxCtx): Promise<SubscriptionDetail>;

  /** API-DEL-05 `cancelSubscription` — `cancel_at_period_end=true`; `E: subscription-cancelled`; `N: subscription.cancelled` to admins. */
  cancelAtPeriodEnd(
    ctx: RequestContext,
    input: CancelSubscriptionInput,
  ): Promise<SubscriptionDetail>;

  /** API-DEL-14 `cancelSubscriptionAdmin` — audited with reason; `immediate` expires the entitlement now. */
  cancelAdmin(
    ctx: RequestContext,
    input: CancelSubscriptionAdminInput,
  ): Promise<SubscriptionDetail>;

  /**
   * Cron `daily/subscriptions.remind_grace_suspend` (docs/06 §3.3, BR-14):
   *  - T−7 d / T−1 d and `reminder_sent_at` outside the window → `N: subscription.reminder` + `E: renewal-reminder`;
   *  - period ended, unpaid, not cancelled → `status='past_due'`, `grace_until = period_end + 7 d`,
   *    entitlement stays `active`, `E: renewal-grace`, `N: subscription.grace`;
   *  - `grace_until < now` → subscription and entitlement `suspended`, handler `onRevoked(soft)`,
   *    `N: subscription.suspended`, `E: subscription-suspended`;
   *  - `cancel_at_period_end` and period ended → `cancelled`, entitlement `expired`.
   * All writes are state-guarded (`where status = X`) so re-runs are no-ops.
   */
  runRemindGraceSuspendJob(job: JobContext): Promise<JobOutcome<RemindGraceSuspendDetail>>;
}
