/**
 * View-model mapper for the customer Notifications screen (SCR-ACC-08) --
 * `modules/notifications`'s `NotificationItem` (a specific event kind, e.g. `"order.paid"`) ->
 * `components/account/types.ts`'s `NotificationItem` (one of five coarse tab groups the screen
 * filters by).
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `actionLabel` is always unset -- the backend event payload has no CTA-label field, so the
 *    screen just shows the notification title/body as a plain link rather than a fabricated
 *    button caption.
 *  - `href` falls back to a section-level page (`/account/purchases`, `/account/queries`, ...)
 *    when the event's own `link` is null; it isn't always the exact created/updated row.
 */
import type {
  NotificationItem as AccountNotificationItem,
  NotificationType as AccountNotificationType,
} from "@/components/account/types";
import type {
  NotificationItem as EventNotificationItem,
  NotificationType as EventType,
} from "@/modules/notifications/types";

const GROUP_BY_EVENT: Record<EventType, AccountNotificationType> = {
  "order.created": "orders",
  "order.paid": "orders",
  "payment.submitted": "orders",
  "payment.failed": "orders",
  "invoice.issued": "orders",
  "refund.issued": "orders",
  "entitlement.granted_manually": "delivery",
  "delivery.task": "delivery",
  "service.progress": "delivery",
  "license.ready": "delivery",
  "subscription.reminder": "renewals",
  "subscription.grace": "renewals",
  "subscription.suspended": "renewals",
  "subscription.cancelled": "renewals",
  "query.new": "queries",
  "query.replied": "queries",
  "query.customer_replied": "queries",
  "product.published": "product_updates",
  "product.updated": "product_updates",
  "quote.sent": "orders",
  "approval.requested": "orders",
  "approval.approved": "orders",
  "approval.rejected": "orders",
  "lead.new": "orders",
  "lead.assigned": "orders",
  "lead.overdue_digest": "orders",
  "chat.cap_reached": "orders",
  "system.job_failed": "orders",
  "system.fx_stale": "orders",
  "finance.reconcile_failed": "orders",
};

const FALLBACK_HREF: Record<AccountNotificationType, string> = {
  orders: "/account/purchases",
  delivery: "/account/purchases",
  renewals: "/account/purchases",
  queries: "/account/queries",
  product_updates: "/account/wishlist",
};

export function mapNotificationItem(n: EventNotificationItem): AccountNotificationItem {
  const type = GROUP_BY_EVENT[n.type] ?? "orders";
  return {
    id: n.id,
    type,
    title: n.title,
    body: n.body ?? "",
    at: n.createdAt,
    read: n.readAt !== null,
    href: n.link ?? FALLBACK_HREF[type],
  };
}
