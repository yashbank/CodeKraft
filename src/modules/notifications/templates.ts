/**
 * Notification templates — the type → audience → channel → email-template matrix of PHASE-06
 * P6.1 (docs/06 §2.11, docs/12 §7, D-707, D-1002, X-012). `render(type, payload)` derives
 * `title` / `body` / `link` for the in-app row; the email template (customer recipients only,
 * plus the admin overdue digest) and its outbox priority come from the same table.
 *
 * Payloads are set by the emitting modules and are deliberately loose (`Record<string, unknown>`):
 * every reader here tolerates missing keys. A payload may override the derived copy with
 * `title` / `body` / `link`, and may select a different email template with `emailTemplate`
 * (e.g. `delivery-saas-credentials`) as long as it is a known `EmailTemplate` name.
 */
import type { EmailTemplate } from "@/lib/email/types";
import { NOTIFICATION_TYPES, type NotificationPayload, type NotificationType } from "./types";
import type { RenderedNotification } from "./types";

export type NotificationAudience = "customer" | "admin";

export interface NotificationTemplate {
  /** Who normally receives the type; admins never get email except `lead.overdue_digest` (X-012). */
  audience: NotificationAudience;
  emailTemplate: EmailTemplate | null;
  /** 1 urgent … 9 digest (`email_outbox.priority`). */
  emailPriority: number;
  /** Customer preference category gating the email (`orderUpdates` is locked on). */
  prefCategory: "orderUpdates" | "productUpdates";
  render(payload: NotificationPayload): { title: string; body: string | null; link: string | null };
}

export const EMAIL_TEMPLATE_NAMES: readonly EmailTemplate[] = [
  "verify-email",
  "reset-password",
  "change-email",
  "one-time-login",
  "phone-otp",
  "order-created-instructions",
  "payment-submitted-ack",
  "payment-confirmed-invoice",
  "delivery-saas-credentials",
  "delivery-license-key",
  "query-reply",
  "query-closed",
  "subscription-reminder",
  "refund-issued",
  "admin-overdue-digest",
];

export function isEmailTemplateName(value: unknown): value is EmailTemplate {
  return typeof value === "string" && (EMAIL_TEMPLATE_NAMES as readonly string[]).includes(value);
}

const str = (p: NotificationPayload, key: string): string | null => {
  const v = p[key];
  if (typeof v === "string" && v.trim() !== "") return v;
  if (typeof v === "number") return String(v);
  return null;
};
const num = (p: NotificationPayload, key: string): number | null => {
  const v = p[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

const orderRef = (p: NotificationPayload) => str(p, "orderNo") ?? "your order";
const orderLink = (p: NotificationPayload) => {
  const id = str(p, "orderId");
  return id === null ? "/account/orders" : `/account/orders/${id}`;
};
const adminOrderLink = (p: NotificationPayload) => {
  const id = str(p, "orderId");
  return id === null ? "/orders" : `/orders/${id}`;
};
const queryLink = (p: NotificationPayload, admin: boolean) => {
  const id = str(p, "queryId");
  const base = admin ? "/queries" : "/account/queries";
  return id === null ? base : `${base}/${id}`;
};
const leadLink = (p: NotificationPayload) => {
  const id = str(p, "leadId");
  return id === null ? "/leads" : `/leads/${id}`;
};
const product = (p: NotificationPayload) => str(p, "productName") ?? "your product";

const T = (
  audience: NotificationAudience,
  emailTemplate: EmailTemplate | null,
  emailPriority: number,
  render: NotificationTemplate["render"],
  prefCategory: NotificationTemplate["prefCategory"] = "orderUpdates",
): NotificationTemplate => ({ audience, emailTemplate, emailPriority, prefCategory, render });

/** PHASE-06 P6.1 matrix; templates outside the `EmailTemplate` union are in-app only. */
export const NOTIFICATION_TEMPLATES: Readonly<Record<NotificationType, NotificationTemplate>> =
  Object.freeze({
    "order.created": T("customer", "order-created-instructions", 2, (p) => ({
      title: `Order ${orderRef(p)} created`,
      body: "Complete the payment using the instructions on the order page.",
      link: orderLink(p),
    })),
    "order.paid": T("customer", "payment-confirmed-invoice", 2, (p) => ({
      title: `Payment confirmed for ${orderRef(p)}`,
      body: "Your invoice is ready and your purchase is being delivered.",
      link: orderLink(p),
    })),
    "payment.submitted": T("admin", "payment-submitted-ack", 3, (p) => ({
      title: `Payment reference submitted for ${orderRef(p)}`,
      body: str(p, "reference") === null ? null : `Reference ${str(p, "reference")}`,
      link: adminOrderLink(p),
    })),
    "payment.failed": T("customer", null, 3, (p) => ({
      title: `Payment for ${orderRef(p)} could not be confirmed`,
      body: str(p, "reason") ?? "Please retry the payment from the order page.",
      link: orderLink(p),
    })),
    "invoice.issued": T("customer", null, 5, (p) => ({
      title: `Invoice ${str(p, "invoiceNo") ?? ""} issued`.replace(/\s+/g, " ").trim(),
      body: `Invoice for ${orderRef(p)} is available in your dashboard.`,
      link: orderLink(p),
    })),
    "delivery.task": T("admin", null, 5, (p) => ({
      title: `Delivery task: ${str(p, "kind") ?? "action needed"}`,
      body: `${product(p)}${str(p, "customerEmail") === null ? "" : ` · ${str(p, "customerEmail")}`}`,
      link: str(p, "taskId") === null ? "/delivery" : `/delivery/tasks/${str(p, "taskId")}`,
    })),
    "service.progress": T("customer", null, 5, (p) => ({
      title: `Progress on ${orderRef(p)}`,
      body: str(p, "stepTitle") ?? "A service step was updated.",
      link: orderLink(p),
    })),
    "license.ready": T("customer", "delivery-license-key", 2, (p) => ({
      title: `Your license for ${product(p)} is ready`,
      body: "Open your dashboard to reveal the key.",
      link: str(p, "entitlementId") === null ? "/account" : `/account/entitlements/${str(p, "entitlementId")}`,
    })),
    "subscription.reminder": T("customer", "subscription-reminder", 5, (p) => ({
      title: `${product(p)} renews ${str(p, "renewsOn") === null ? "soon" : `on ${str(p, "renewsOn")}`}`,
      body: "Renew before the period ends to keep access.",
      link: "/account/subscriptions",
    })),
    "subscription.grace": T("customer", null, 4, (p) => ({
      title: `${product(p)} is past due`,
      body: "You have a 7-day grace period to renew before access is suspended.",
      link: "/account/subscriptions",
    })),
    "subscription.suspended": T("customer", null, 3, (p) => ({
      title: `${product(p)} access suspended`,
      body: "Renew your subscription to restore access.",
      link: "/account/subscriptions",
    })),
    "subscription.cancelled": T("admin", null, 6, (p) => ({
      title: `Subscription cancelled: ${product(p)}`,
      body: str(p, "customerEmail"),
      link: "/subscriptions",
    })),
    "refund.issued": T("customer", "refund-issued", 3, (p) => ({
      title: `Refund issued for ${orderRef(p)}`,
      body: "Your credit note is attached to the order.",
      link: orderLink(p),
    })),
    "approval.requested": T("admin", null, 5, (p) => ({
      title: `Approval requested: ${str(p, "approvalType") ?? "action"}`,
      body: str(p, "summary"),
      link: str(p, "approvalRequestId") === null ? "/approvals" : `/approvals/${str(p, "approvalRequestId")}`,
    })),
    "approval.approved": T("admin", null, 5, (p) => ({
      title: `Approved: ${str(p, "approvalType") ?? "your request"}`,
      body: str(p, "summary"),
      link: str(p, "approvalRequestId") === null ? "/approvals" : `/approvals/${str(p, "approvalRequestId")}`,
    })),
    "approval.rejected": T("admin", null, 5, (p) => ({
      title: `Rejected: ${str(p, "approvalType") ?? "your request"}`,
      body: str(p, "reason") ?? str(p, "summary"),
      link: str(p, "approvalRequestId") === null ? "/approvals" : `/approvals/${str(p, "approvalRequestId")}`,
    })),
    "lead.new": T("admin", null, 5, (p) => ({
      title: `New lead: ${str(p, "name") ?? "inquiry"}`,
      body: str(p, "source") === null ? null : `via ${str(p, "source")}`,
      link: leadLink(p),
    })),
    "lead.assigned": T("admin", null, 5, (p) => ({
      title: `Lead assigned to you: ${str(p, "name") ?? "lead"}`,
      body: str(p, "assignedByName") === null ? null : `by ${str(p, "assignedByName")}`,
      link: leadLink(p),
    })),
    "lead.overdue_digest": T("admin", "admin-overdue-digest", 9, (p) => ({
      title: "Daily follow-up digest",
      body: `${num(p, "overdueLeads") ?? 0} overdue lead(s), ${num(p, "openRevokeTasks") ?? 0} open revoke task(s)`,
      link: "/leads?overdue=true",
    })),
    "query.new": T("admin", null, 5, (p) => ({
      title: `New query: ${str(p, "subject") ?? "support request"}`,
      body: str(p, "customerEmail"),
      link: queryLink(p, p["forCustomer"] !== true),
    })),
    "query.replied": T("customer", "query-reply", 4, (p) => ({
      title: `Reply on: ${str(p, "subject") ?? "your query"}`,
      body: str(p, "preview"),
      link: queryLink(p, false),
    })),
    "query.customer_replied": T("admin", null, 5, (p) => ({
      title: `Customer replied: ${str(p, "subject") ?? "query"}`,
      body: str(p, "preview"),
      link: queryLink(p, true),
    })),
    "product.published": T("admin", null, 6, (p) => ({
      title: `Published: ${product(p)}`,
      body: null,
      link: str(p, "productId") === null ? "/catalog" : `/catalog/${str(p, "productId")}`,
    })),
    "product.updated": T(
      "customer",
      null,
      7,
      (p) => ({
        title: `${product(p)} was updated`,
        body: str(p, "version") === null ? null : `Version ${str(p, "version")} is available.`,
        link: str(p, "entitlementId") === null ? "/account" : `/account/entitlements/${str(p, "entitlementId")}`,
      }),
      "productUpdates",
    ),
    "quote.sent": T("customer", null, 3, (p) => ({
      title: "You have a custom quote",
      body: str(p, "summary"),
      link: str(p, "token") === null ? "/account" : `/quote/${str(p, "token")}`,
    })),
    "entitlement.granted_manually": T("admin", null, 5, (p) => ({
      title: `Manual entitlement granted: ${product(p)}`,
      body: str(p, "reason"),
      link: str(p, "entitlementId") === null ? "/entitlements" : `/entitlements/${str(p, "entitlementId")}`,
    })),
    "chat.cap_reached": T("admin", null, 6, (p) => ({
      title: "Chatbot daily cap reached",
      body: str(p, "scope") === null ? null : `Scope: ${str(p, "scope")}`,
      link: "/chat",
    })),
    "system.job_failed": T("admin", null, 4, (p) => ({
      title: `Job failed: ${str(p, "job") ?? "unknown"}`,
      body: str(p, "error"),
      link: "/system/jobs",
    })),
    "system.fx_stale": T("admin", null, 6, () => ({
      title: "FX rates are stale",
      body: "The last successful refresh is older than 3 days.",
      link: "/settings",
    })),
    "finance.reconcile_failed": T("admin", null, 3, (p) => ({
      title: "Ledger reconciliation found discrepancies",
      body: num(p, "discrepancies") === null ? null : `${num(p, "discrepancies")} discrepancy(ies)`,
      link: "/finance/reconcile",
    })),
  });

/** Every type has an entry (compile-time via the Record; runtime check for the unit test). */
export function templateFor(type: NotificationType): NotificationTemplate {
  const t = NOTIFICATION_TEMPLATES[type];
  if (t === undefined) throw new RangeError(`no notification template for ${String(type)}`);
  return t;
}

export function hasTemplateForEveryType(): boolean {
  return NOTIFICATION_TYPES.every((t) => NOTIFICATION_TEMPLATES[t] !== undefined);
}

/** Title / body / link / email template for one row; payload overrides win. */
export function renderNotification(
  type: NotificationType,
  payload: NotificationPayload,
): RenderedNotification {
  const t = templateFor(type);
  const derived = t.render(payload);
  const override = payload["emailTemplate"];
  const emailTemplate = isEmailTemplateName(override) ? override : t.emailTemplate;
  const priority = num(payload, "emailPriority");
  return {
    title: str(payload, "title") ?? derived.title,
    body: str(payload, "body") ?? derived.body,
    link: str(payload, "link") ?? derived.link,
    emailTemplate,
    emailPriority: priority !== null && priority >= 1 && priority <= 9 ? priority : t.emailPriority,
  };
}
