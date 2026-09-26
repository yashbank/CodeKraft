import type { NotificationPayload, NotificationType, RenderedNotification } from "../types";

export function renderNotification(
  type: NotificationType,
  payload: NotificationPayload,
): RenderedNotification {
  const p = payload as Record<string, any>;

  switch (type) {
    case "order.created":
      return {
        title: `Order Created #${p.orderNumber ?? p.orderId ?? ""}`.trim(),
        body: "Your order has been placed. Please complete the payment to activate your access.",
        link: p.orderId ? `/account/orders/${p.orderId}` : "/account/orders",
        emailTemplate: "order-created-instructions",
        emailPriority: 1,
      };

    case "order.paid":
      return {
        title: `Payment Confirmed #${p.orderNumber ?? p.orderId ?? ""}`.trim(),
        body: "Your payment has been verified. Your products and services are now accessible.",
        link: p.orderId ? `/account/orders/${p.orderId}` : "/account/purchases",
        emailTemplate: "payment-confirmed-invoice",
        emailPriority: 1,
      };

    case "payment.submitted":
      return {
        title: `Payment Reference Submitted: #${p.orderNumber ?? p.orderId ?? ""}`.trim(),
        body: `Payment reference ${p.reference ?? ""} submitted for order ${p.orderNumber ?? p.orderId ?? ""}.`,
        link: p.orderId ? `/admin/orders/${p.orderId}` : "/admin/orders",
        emailTemplate: null, // admin in-app only (ack email sent separately)
        emailPriority: 5,
      };

    case "payment.failed":
      return {
        title: `Payment Failed #${p.orderNumber ?? p.orderId ?? ""}`.trim(),
        body: p.reason ?? "Your payment could not be processed. Please try again or submit a new reference.",
        link: p.orderId ? `/account/orders/${p.orderId}` : "/account/orders",
        emailTemplate: null,
        emailPriority: 1,
      };

    case "invoice.issued":
      return {
        title: `Invoice Issued: ${p.invoiceNumber ?? ""}`.trim(),
        body: `Tax invoice ${p.invoiceNumber ?? ""} is ready for download.`,
        link: p.invoiceId ? `/account/invoices/${p.invoiceId}` : "/account/invoices",
        emailTemplate: null, // delivered with payment-confirmed-invoice
        emailPriority: 5,
      };

    case "delivery.task":
      return {
        title: `Fulfillment Task: ${p.title ?? p.serviceName ?? "New Task"}`,
        body: `Action required: ${p.description ?? "Manual provisioning step required."}`,
        link: p.taskId ? `/admin/delivery-tasks/${p.taskId}` : "/admin/delivery-tasks",
        emailTemplate: null, // admin in-app only
        emailPriority: 5,
      };

    case "service.progress":
      return {
        title: `Service Update: ${p.stepTitle ?? p.serviceName ?? "Progress Step"}`,
        body: p.notes ?? "A new update has been logged on your custom service project.",
        link: p.entitlementId ? `/account/purchases/${p.entitlementId}` : "/account/purchases",
        emailTemplate: null,
        emailPriority: 5,
      };

    case "license.ready":
      return {
        title: `License Key Generated: ${p.productTitle ?? "Product"}`,
        body: "Your license key has been generated and is ready in your account portal.",
        link: p.entitlementId ? `/account/purchases/${p.entitlementId}` : "/account/purchases",
        emailTemplate: "delivery-license-key",
        emailPriority: 1,
      };

    case "subscription.reminder":
      return {
        title: `Subscription Renewal Reminder: ${p.productTitle ?? "Subscription"}`,
        body: `Your subscription is scheduled to renew on ${p.renewalDate ?? "soon"}.`,
        link: "/account/purchases",
        emailTemplate: "subscription-reminder",
        emailPriority: 5,
      };

    case "subscription.grace":
      return {
        title: `Subscription Grace Period: ${p.productTitle ?? "Subscription"}`,
        body: "Your renewal payment is overdue. Your access is in a grace period.",
        link: "/account/purchases",
        emailTemplate: null,
        emailPriority: 1,
      };

    case "subscription.suspended":
      return {
        title: `Subscription Suspended: ${p.productTitle ?? "Subscription"}`,
        body: "Your subscription access has been suspended due to overdue payment.",
        link: "/account/purchases",
        emailTemplate: null,
        emailPriority: 1,
      };

    case "subscription.cancelled":
      return {
        title: `Subscription Cancelled: ${p.productTitle ?? "Subscription"}`,
        body: "Your subscription has been cancelled.",
        link: "/account/purchases",
        emailTemplate: null,
        emailPriority: 5,
      };

    case "refund.issued":
      return {
        title: `Refund Processed #${p.creditNoteNumber ?? p.orderNumber ?? ""}`.trim(),
        body: `Refund of ${p.amount ?? ""} has been processed. Credit note issued.`,
        link: "/account/invoices",
        emailTemplate: "refund-issued",
        emailPriority: 1,
      };

    case "approval.requested":
      return {
        title: `Approval Required: ${p.kind ?? "Dual Approval Request"}`,
        body: `${p.requesterName ?? "An administrator"} submitted an action requiring your review.`,
        link: p.approvalId ? `/admin/approvals/${p.approvalId}` : "/admin/approvals",
        emailTemplate: null, // admin in-app only
        emailPriority: 1,
      };

    case "approval.approved":
      return {
        title: `Approval Granted: ${p.kind ?? "Request"}`,
        body: `Your request has been approved by ${p.approverName ?? "admin"}.`,
        link: p.approvalId ? `/admin/approvals/${p.approvalId}` : "/admin/approvals",
        emailTemplate: null,
        emailPriority: 5,
      };

    case "approval.rejected":
      return {
        title: `Approval Rejected: ${p.kind ?? "Request"}`,
        body: `Your request was rejected. Reason: ${p.reason ?? "None specified"}.`,
        link: p.approvalId ? `/admin/approvals/${p.approvalId}` : "/admin/approvals",
        emailTemplate: null,
        emailPriority: 5,
      };

    case "lead.new":
      return {
        title: `New Lead: ${p.leadName ?? p.name ?? "Inquiry"}`,
        body: `${p.company ? p.company + " - " : ""}${p.message ?? "New inquiry received"}`,
        link: p.leadId ? `/admin/leads/${p.leadId}` : "/admin/leads",
        emailTemplate: null, // admin in-app only
        emailPriority: 5,
      };

    case "lead.assigned":
      return {
        title: `Lead Assigned to You: ${p.leadName ?? p.name ?? "Lead"}`,
        body: `You have been assigned to follow up on ${p.leadName ?? "this lead"}.`,
        link: p.leadId ? `/admin/leads/${p.leadId}` : "/admin/leads",
        emailTemplate: null,
        emailPriority: 5,
      };

    case "lead.overdue_digest":
      return {
        title: "Daily Overdue Leads Digest",
        body: `You have ${p.overdueCount ?? 0} overdue lead(s) requiring follow-up.`,
        link: "/admin/leads?overdue=true",
        emailTemplate: "admin-overdue-digest", // recurring admin email
        emailPriority: 9,
      };

    case "query.new":
      return {
        title: `New Support Query: ${p.subject ?? "Support Request"}`,
        body: `${p.guestEmail ?? p.userName ?? "User"}: ${p.preview ?? "New query opened"}`,
        link: p.queryId ? `/admin/queries/${p.queryId}` : "/admin/queries",
        emailTemplate: null,
        emailPriority: 5,
      };

    case "query.replied":
      return {
        title: `Support Reply: ${p.subject ?? "Your Query"}`,
        body: "A support team member has replied to your query.",
        link: p.queryId ? `/account/queries/${p.queryId}` : "/account/queries",
        emailTemplate: "query-reply",
        emailPriority: 5,
      };

    case "query.customer_replied":
      return {
        title: `Customer Reply: ${p.subject ?? "Query"}`,
        body: `${p.customerName ?? "Customer"} has replied to query thread #${p.queryId ?? ""}.`,
        link: p.queryId ? `/admin/queries/${p.queryId}` : "/admin/queries",
        emailTemplate: null,
        emailPriority: 5,
      };

    case "product.published":
      return {
        title: `Product Published: ${p.title ?? "New Product"}`,
        body: "Product is now live in the catalog.",
        link: p.slug ? `/products/${p.slug}` : "/admin/products",
        emailTemplate: null,
        emailPriority: 5,
      };

    case "product.updated":
      return {
        title: `Product Update: ${p.title ?? "Update Available"}`,
        body: `A new version (${p.version ?? "latest"}) has been released for ${p.title ?? "your product"}.`,
        link: p.productId ? `/account/purchases?product=${p.productId}` : "/account/purchases",
        emailTemplate: null,
        emailPriority: 5,
      };

    case "quote.sent":
      return {
        title: `Custom Quote Received: ${p.title ?? "Quote"}`,
        body: `A custom quote for ${p.amount ?? ""} has been prepared for your review.`,
        link: p.token ? `/quotes/${p.token}` : "/account",
        emailTemplate: null,
        emailPriority: 1,
      };

    case "entitlement.granted_manually":
      return {
        title: `Manual Entitlement Granted: ${p.productTitle ?? "Product"}`,
        body: `Access granted manually by admin. Reason: ${p.reason ?? "Customer support"}.`,
        link: p.entitlementId ? `/account/purchases/${p.entitlementId}` : "/account/purchases",
        emailTemplate: null,
        emailPriority: 5,
      };

    case "chat.cap_reached":
      return {
        title: "Chat Daily Limit Reached",
        body: "Daily AI chatbot usage capacity has been reached. System is operating in menu fallback mode.",
        link: "/admin/analytics",
        emailTemplate: null,
        emailPriority: 5,
      };

    case "system.job_failed":
      return {
        title: `Scheduled Job Failed: ${p.job ?? "Cron"}`,
        body: `Error in ${p.job ?? "job"}: ${p.error ?? "Unexpected failure"}`,
        link: "/admin/settings",
        emailTemplate: null,
        emailPriority: 1,
      };

    case "system.fx_stale":
      return {
        title: "Foreign Exchange Rates Stale",
        body: `FX rates have not been updated for ${p.days ?? 2} days. Using fallback rates.`,
        link: "/admin/settings",
        emailTemplate: null,
        emailPriority: 5,
      };

    case "finance.reconcile_failed":
      return {
        title: "Nightly Financial Reconciliation Discrepancy",
        body: `Discrepancy detected during reconcile job: ${p.discrepancy ?? "Ledger mismatch"}.`,
        link: "/admin/finance",
        emailTemplate: null,
        emailPriority: 1,
      };

    default:
      return {
        title: `Notification: ${type}`,
        body: null,
        link: null,
        emailTemplate: null,
        emailPriority: 5,
      };
  }
}
