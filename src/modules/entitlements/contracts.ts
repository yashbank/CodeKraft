/**
 * Entitlements service contract — master plan §5 (`entitlements.grantForOrder(orderId, tx)`,
 * `entitlements.revoke(entitlementId, reason, tx)`, `grantManual(input, tx)`), docs/06 §2.5,
 * §5.1 step "entitlement → delivery", §5.7 (download cap), MASTER_SPEC §7 "Manual entitlement
 * grants" / "Order fulfilled" / "License key delivery".
 *
 * Frozen in P2 (changes need an ADR, docs/06 §6). Implementation lands in P5.
 */
import type { TxCtx } from "@/lib/db";
import type { RequestContext } from "@/lib/authz/context";
import type { Entitlement } from "../../../drizzle/schema/delivery";
import type {
  DownloadLinkResult,
  EntitlementAdminRow,
  EntitlementView,
  ExtendAccessInput,
  GetEntitlementAdminInput,
  GetMyEntitlementInput,
  GrantEntitlementInput,
  GrantEntitlementResult,
  IssueDownloadLinkInput,
  LicenseKeyReveal,
  ListEntitlementsAdminInput,
  ListMyEntitlementsInput,
  ListResult,
  ResetDownloadCountInput,
  RevealLicenseKeyInput,
  RevokeEntitlementInput,
  RevokeEntitlementResult,
} from "./types";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";

/** Reason strings recorded on `entitlements.revoke_reason` by system paths (admin paths pass free text). */
export type SystemRevokeReason = "refund" | "subscription_suspended" | "subscription_cancelled";

/** Result of `grantForOrder`: one row per order item (empty when the order created none, e.g. project orders). */
export interface GrantedEntitlement {
  entitlementId: string;
  orderItemId: string;
  deliveryType: Entitlement["deliveryType"];
  status: Entitlement["status"];
  /** Delivery tasks the handler opened (`provision` for manual SaaS/hosted). */
  taskIds: string[];
}

export interface EntitlementsService {
  /**
   * Master plan §5 / docs/06 §5.1 step 6: called by `payments.confirm` (API-PAY-03) inside the
   * caller's transaction after `finance.postOrderPaid`. Creates one `entitlements` row per
   * order item (`subscriptions` row for subscription offerings, `service_progress` rows from
   * `offerings.service_steps`), runs each `DeliveryHandler.onGranted`, and marks the order
   * `fulfilled` when every entitlement is `active` and every checklist is complete
   * (MASTER_SPEC §7 "Order fulfilled"). Idempotent per `order_item_id` (partial unique index).
   * Renewal orders are routed to `SubscriptionsService.onRenewalPaid` instead of creating rows.
   */
  grantForOrder(orderId: string, tx: TxCtx): Promise<GrantedEntitlement[]>;

  /**
   * API-DEL-11 `grantEntitlement` — `entitlements.admin`. Manual grant with mandatory reason;
   * `order_item_id = null`, `granted_manually_by = ctx.userId`; no order/invoice/ledger writes
   * (D-1108); audit row carries `reason`; `N: entitlement.granted_manually` to every other admin;
   * `E: access-granted`. Fails `DUPLICATE_PURCHASE` for an already-owned one-time offering.
   */
  grantManual(
    ctx: RequestContext,
    input: GrantEntitlementInput,
    tx?: TxCtx,
  ): Promise<GrantEntitlementResult>;

  /**
   * Master plan §5 `entitlements.revoke(entitlementId, reason, tx)` — system entry point used by
   * refunds (docs/06 §5.2) and the subscription cron. Sets `status='revoked'`, `revoked_at`,
   * `revoke_reason`, then `DeliveryHandler.onRevoked(mode:'hard')`; automatic vs
   * `delivery_tasks(revoke_external)` is the handler's call (D-607). `E: access-revoked`.
   */
  revoke(
    entitlementId: string,
    reason: SystemRevokeReason | string,
    tx: TxCtx,
  ): Promise<RevokeEntitlementResult>;

  /** API-DEL-12 `revokeEntitlement` — admin wrapper around `revoke` with audit + scope check. */
  revokeEntitlement(
    ctx: RequestContext,
    input: RevokeEntitlementInput,
  ): Promise<RevokeEntitlementResult>;

  /** API-DEL-01 `listMyEntitlements` — `delivery.self`. */
  listMyEntitlements(
    ctx: RequestContext,
    input: ListMyEntitlementsInput,
  ): Promise<ListResult<EntitlementView>>;

  /** API-DEL-01 `getMyEntitlement` — `NOT_FOUND` when not owned by the caller. */
  getMyEntitlement(ctx: RequestContext, input: GetMyEntitlementInput): Promise<EntitlementView>;

  /**
   * API-DEL-02 `issueDownloadLink` — `delivery.self`, rate class `download`. Atomic
   * `UPDATE … SET downloads_used = downloads_used + 1 WHERE downloads_used < download_cap`
   * (0 rows → `LIMIT_EXCEEDED`, message asks the customer to contact admin, D-606);
   * `STATE_INVALID` unless `active` and inside the access window (D-605); `NOT_FOUND` when the
   * media is not a `release_files` row allowed by `update_policy`. Writes `downloads(ip, ua)` and audits.
   */
  issueDownloadLink(
    ctx: RequestContext,
    input: IssueDownloadLinkInput,
  ): Promise<DownloadLinkResult>;

  /** API-DEL-03 `revealLicenseKey` — rate class `key_reveal`; audit `license.revealed`; `NOT_FOUND` when no key yet. */
  revealLicenseKey(ctx: RequestContext, input: RevealLicenseKeyInput): Promise<LicenseKeyReveal>;

  /** API-DEL-06 `listEntitlementsAdmin` — `delivery.tasks.write`; rows carry handler `adminActions`. */
  listEntitlementsAdmin(
    ctx: RequestContext,
    input: ListEntitlementsAdminInput,
  ): Promise<ListResult<EntitlementAdminRow>>;

  /** API-DEL-06 `getEntitlementAdmin`. */
  getEntitlementAdmin(
    ctx: RequestContext,
    input: GetEntitlementAdminInput,
  ): Promise<EntitlementAdminRow>;

  /** API-DEL-13 `resetDownloadCount` — `downloads_used = 0`, optional new `download_cap` (D-606); audited. */
  resetDownloadCount(
    ctx: RequestContext,
    input: ResetDownloadCountInput,
  ): Promise<EntitlementAdminRow>;

  /** API-DEL-14 `extendAccess` — `entitlements.access_ends_at` or `subscriptions.current_period_end`; audited with reason. */
  extendAccess(ctx: RequestContext, input: ExtendAccessInput): Promise<EntitlementAdminRow>;

  /**
   * Cron `daily/entitlements.expire` (docs/06 §3.3): one-time entitlements with
   * `access_ends_at < now` and `status='active'` → `expired` (D-605). State-guarded update;
   * `outcome.detail.expired` = row count.
   */
  runExpireJob(job: JobContext): Promise<JobOutcome<{ expired: number }>>;
}
