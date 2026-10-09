/**
 * View-model mapper: `modules/notifications` item shape -> admin component prop shape
 * (`components/admin/types`). Kept out of the page component per the phase convention (mapping
 * never lives in a component) and out of the component itself (it stays props-driven).
 *
 * Known gaps vs. a fully-populated screen -- see the phase report for the full list:
 *  - The component's `NotificationType` is a coarse 7-value category (payments/leads/queries/
 *    approvals/delivery/chatbot/system); the module tracks ~30 fine-grained event types (docs/06
 *    §2.11). `NOTIFICATION_TYPE_CATEGORY` below is the categorisation used to bucket them.
 *  - `action` (an inline CTA button distinct from the row's own link) is always `undefined`: the
 *    module only stores one `link` per notification, not a separate labelled action.
 */
import type {
  NotificationItem,
  NotificationType as ModuleNotificationType,
} from "@/modules/notifications/types";
import type { AdminNotification, NotificationType } from "@/components/admin/types";

export const NOTIFICATION_TYPE_CATEGORY: Record<ModuleNotificationType, NotificationType> = {
  "order.created": "payments",
  "order.paid": "payments",
  "payment.submitted": "payments",
  "payment.failed": "payments",
  "invoice.issued": "payments",
  "refund.issued": "payments",
  "subscription.reminder": "payments",
  "subscription.grace": "payments",
  "subscription.suspended": "payments",
  "subscription.cancelled": "payments",
  "delivery.task": "delivery",
  "service.progress": "delivery",
  "license.ready": "delivery",
  "entitlement.granted_manually": "delivery",
  "approval.requested": "approvals",
  "approval.approved": "approvals",
  "approval.rejected": "approvals",
  "lead.new": "leads",
  "lead.assigned": "leads",
  "lead.overdue_digest": "leads",
  "query.new": "queries",
  "query.replied": "queries",
  "query.customer_replied": "queries",
  "product.published": "system",
  "product.updated": "system",
  "quote.sent": "system",
  "chat.cap_reached": "chatbot",
  "system.job_failed": "system",
  "system.fx_stale": "system",
  "finance.reconcile_failed": "system",
};

export function mapNotificationItem(item: NotificationItem): AdminNotification {
  return {
    id: item.id,
    type: NOTIFICATION_TYPE_CATEGORY[item.type] ?? "system",
    title: item.title,
    body: item.body ?? "",
    at: item.createdAt,
    read: item.readAt !== null,
    href: item.link ?? undefined,
  };
}
