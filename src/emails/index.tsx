import React from "react";
import { render } from "@react-email/components";
import { documentMoney } from "@/lib/document-money";
import { brandSubject } from "@/lib/email/branding";
import { isCurrency, parseMinor } from "@/lib/money";
import { EmailButton, EmailLayout, emailStyles } from "@/lib/email/render";
import { loadEmailTheme, type EmailTheme } from "@/lib/email/theme";
import { Text } from "@react-email/components";

export interface RenderTemplateOptions {
  siteUrl?: string;
  data: Record<string, unknown>;
}

export interface EmailTemplateDefinition {
  name: string;
  subject: (data: Record<string, unknown>) => string;
  render: (
    data: Record<string, unknown>,
    siteUrl?: string,
    theme?: EmailTheme,
  ) => Promise<{ html: string; text: string }>;
}

/** Quote/refund payloads carry a decimal `amount` string + `currency`; render with symbol and grouping. */
function emailMoney(d: Record<string, unknown>): string {
  const cur = String(d.currency ?? "");
  // amount: quotes/order-created; total: invoice; amountPaid: payment-confirmed.
  const raw = d.amount ?? d.total ?? d.amountPaid;
  if (typeof d.amountMinor === "number" && isCurrency(cur))
    return documentMoney(d.amountMinor, cur);
  if ((typeof raw === "string" || typeof raw === "number") && isCurrency(cur)) {
    try {
      return documentMoney(parseMinor(String(raw), cur), cur);
    } catch {
      // fall through to the raw text
    }
  }
  return `${cur} ${String(raw ?? "")}`.trim();
}

/** Money text, or "" when the payload has no amount/currency (old queued rows). */
function moneyOrEmpty(d: Record<string, unknown>): string {
  const has = d.amountMinor != null || d.amount != null || d.total != null || d.amountPaid != null;
  return has && d.currency ? emailMoney(d) : "";
}

function defaultSiteUrl(): string {
  // process.env: this module also loads in jsdom tests where lib/env throws.
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function makeTemplate(
  name: string,
  subjectFn: (data: Record<string, unknown>) => string,
  bodyFn: (data: Record<string, unknown>) => React.ReactNode,
): EmailTemplateDefinition {
  return {
    name,
    subject: subjectFn,
    async render(data: Record<string, unknown>, siteUrl?: string, theme?: EmailTheme) {
      const subject = subjectFn(data);
      const t = theme ?? (await loadEmailTheme());
      const url = siteUrl ?? defaultSiteUrl();
      const element = (
        <EmailLayout
          preview={brandSubject(subject, t.siteName)}
          title={brandSubject(subject, t.siteName)}
          siteUrl={url}
          theme={t}
        >
          {bodyFn(data)}
        </EmailLayout>
      );
      const html = await render(element);
      const text = await render(element, { plainText: true });
      return { html, text };
    },
  };
}

export const EMAIL_TEMPLATES: Record<string, EmailTemplateDefinition> = {
  "verify-email": makeTemplate(
    "verify-email",
    () => "Verify your CodeKraft email address",
    (d) => (
      <>
        <Text style={emailStyles.p}>Please click the link below to verify your email address:</Text>
        <EmailButton href={d.url as string}>Verify Email</EmailButton>
        <Text className="ek-muted" style={emailStyles.muted}>
          Or paste this address into your browser: {d.url as string}
        </Text>
      </>
    ),
  ),
  "reset-password": makeTemplate(
    "reset-password",
    () => "Reset your CodeKraft password",
    (d) => (
      <>
        <Text style={emailStyles.p}>Use this button to reset your password:</Text>
        <EmailButton href={d.url as string}>Reset Password</EmailButton>
        <Text className="ek-muted" style={emailStyles.muted}>
          Or paste this address into your browser: {d.url as string}
        </Text>
      </>
    ),
  ),
  "one-time-login": makeTemplate(
    "one-time-login",
    () => "Your CodeKraft login code",
    (d) => (
      <>
        <Text style={emailStyles.p}>Your one-time code is:</Text>
        <Text style={emailStyles.code}>{d.code as string}</Text>
      </>
    ),
  ),
  "order-created-instructions": makeTemplate(
    "order-created-instructions",
    (d) => `Payment Instructions for Order #${d.orderNumber ?? ""}`,
    (d) => (
      <>
        <Text style={emailStyles.p}>Order #{String(d.orderNumber ?? "")} is awaiting payment.</Text>
        <Text style={emailStyles.p}>
          Please complete payment via UPI or Bank transfer and submit your reference.
        </Text>
        {d.url && <EmailButton href={d.url as string}>Submit Payment Reference</EmailButton>}
      </>
    ),
  ),
  "payment-submitted-ack": makeTemplate(
    "payment-submitted-ack",
    (d) => `Payment Reference Received #${d.orderNumber ?? ""}`,
    () => (
      <Text style={emailStyles.p}>
        We have received your payment reference. An administrator will verify it shortly.
      </Text>
    ),
  ),
  "payment-confirmed-invoice": makeTemplate(
    "payment-confirmed-invoice",
    (d) => `Payment Confirmed & Invoice #${d.orderNumber ?? ""}`,
    () => (
      <>
        <Text style={emailStyles.p}>
          Your payment has been verified and your purchase is ready.
        </Text>
        <EmailButton href="/account/purchases">View Purchases</EmailButton>
      </>
    ),
  ),
  "delivery-license-key": makeTemplate(
    "delivery-license-key",
    (d) => `License Ready: ${d.productTitle ?? "Product"}`,
    () => (
      <>
        <Text style={emailStyles.p}>
          Your license key has been generated and is ready in your customer portal.
        </Text>
        <Text className="ek-muted" style={emailStyles.muted}>
          For security reasons, license keys are never sent over email. Please view and reveal your
          key in your portal.
        </Text>
        <EmailButton href="/account/purchases">View License Key in Portal</EmailButton>
      </>
    ),
  ),
  "subscription-reminder": makeTemplate(
    "subscription-reminder",
    (d) => `Upcoming Subscription Renewal: ${d.productTitle ?? "Subscription"}`,
    () => (
      <Text style={emailStyles.p}>
        Your subscription is scheduled to renew soon. Please ensure your payment method or reference
        is up to date.
      </Text>
    ),
  ),
  "query-reply": makeTemplate(
    "query-reply",
    (d) => `Reply to Query: ${d.subject ?? "Support Request"}`,
    (d) => (
      <>
        <Text style={emailStyles.p}>Our team has replied to your support query.</Text>
        <EmailButton
          href={
            (d.url as string) ??
            (d.queryId ? `/account/queries/${String(d.queryId)}` : "/account/queries")
          }
        >
          View Reply
        </EmailButton>
      </>
    ),
  ),
  "query-closed": makeTemplate(
    "query-closed",
    (d) => `Query Closed: ${d.subject ?? "Support Request"}`,
    () => (
      <Text style={emailStyles.p}>
        Your query thread has been marked as closed. You can submit a new query at any time.
      </Text>
    ),
  ),
  "admin-overdue-digest": makeTemplate(
    "admin-overdue-digest",
    () => "Daily Admin Digest: Overdue Leads and Tasks",
    (d) => (
      <>
        <Text style={emailStyles.p}>Here is your daily summary of items needing follow-up:</Text>
        <Text style={emailStyles.p}>Overdue leads: {String(d.overdueCount ?? 0)}</Text>
        <Text style={emailStyles.p}>Open revoke tasks: {String(d.revokeTasksCount ?? 0)}</Text>
        <EmailButton href="/admin/leads?overdue=true">Open Admin Dashboard</EmailButton>
      </>
    ),
  ),
  "refund-issued": makeTemplate(
    "refund-issued",
    (d) => `Credit Note Issued #${d.creditNoteNumber ?? d.creditNo ?? ""}`.trim(),
    (d) => (
      <Text style={emailStyles.p}>
        Your refund{d.amountMinor != null ? ` of ${emailMoney(d)}` : ""} has been approved and a
        credit note has been issued.
      </Text>
    ),
  ),
  "approval-needed": makeTemplate(
    "approval-needed",
    (d) => `Approval needed: ${d.summary ?? ""}`,
    (d) => (
      <>
        <Text style={emailStyles.p}>
          {String(d.requesterName ?? "An admin")} requested approval: {String(d.summary ?? "")}
        </Text>
        <EmailButton href={(d.url as string) ?? "/admin/approvals"}>Review Request</EmailButton>
      </>
    ),
  ),
  "approval-decided": makeTemplate(
    "approval-decided",
    (d) => `Approval ${d.outcome ?? "decided"}: ${d.summary ?? ""}`,
    (d) => (
      <>
        <Text style={emailStyles.p}>
          Your request ({String(d.summary ?? "")}) was {String(d.outcome ?? "decided")}.
        </Text>
        <EmailButton href={(d.url as string) ?? "/admin/approvals"}>View Approvals</EmailButton>
      </>
    ),
  ),
  "custom-quote": makeTemplate(
    "custom-quote",
    (d) =>
      `${d.resend ? "Reminder: your" : "Your"} quote: ${d.title ?? "Custom quote"} (${emailMoney(d)})`,
    (d) => (
      <>
        <Text style={emailStyles.p}>
          We prepared a custom quote for you: {String(d.title ?? "")} - {emailMoney(d)}
          {d.validUntil ? `, valid until ${String(d.validUntil)}` : ""}.
        </Text>
        <EmailButton href={String(d.payUrl ?? "/account/quotes")}>Review quote</EmailButton>
      </>
    ),
  ),
  invoice: makeTemplate(
    "invoice",
    (d) => `Your invoice${d.invoiceNo ? ` ${d.invoiceNo}` : ""}`,
    (d) => (
      <>
        <Text style={emailStyles.p}>
          Your invoice{d.invoiceNo ? ` ${String(d.invoiceNo)}` : ""}
          {d.orderNo ? ` for order ${String(d.orderNo)}` : ""} has been issued
          {moneyOrEmpty(d) ? `. Total charged: ${moneyOrEmpty(d)}` : ""}.
        </Text>
        <EmailButton href={String(d.url ?? "/account/invoices")}>View invoice</EmailButton>
      </>
    ),
  ),
  "order-created": makeTemplate(
    "order-created",
    (d) => `Order ${d.orderNo ?? ""} placed - complete your payment`.replace("  ", " "),
    (d) => (
      <>
        <Text style={emailStyles.p}>
          {d.name ? `Hi ${String(d.name)}, we` : "We"} received your order
          {d.orderNo ? ` ${String(d.orderNo)}` : ""}
          {d.offeringName ? ` for ${String(d.offeringName)}` : ""}
          {moneyOrEmpty(d) ? ` (${moneyOrEmpty(d)})` : ""}. It is awaiting payment.
        </Text>
        <EmailButton href={String(d.url ?? "/account/orders")}>Complete payment</EmailButton>
      </>
    ),
  ),
  "order-expired": makeTemplate(
    "order-expired",
    (d) => `Order ${d.orderNo ?? ""} expired`.replace("  ", " "),
    (d) => (
      <>
        <Text style={emailStyles.p}>
          Order{d.orderNo ? ` ${String(d.orderNo)}` : ""} expired because payment was not received
          in time. Nothing was charged. You can place a new order at any time.
        </Text>
        <EmailButton href="/products">Browse products</EmailButton>
      </>
    ),
  ),
  "payment-failed": makeTemplate(
    "payment-failed",
    (d) => `Payment failed for order ${d.orderNo ?? ""}`.trim(),
    (d) => (
      <>
        <Text style={emailStyles.p}>
          We could not confirm your payment for order{d.orderNo ? ` ${String(d.orderNo)}` : ""}.
          Please check your order and try again, or contact support if you were charged.
        </Text>
        <EmailButton href={String(d.url ?? "/account/orders")}>View order</EmailButton>
      </>
    ),
  ),
  "payment-confirmed": makeTemplate(
    "payment-confirmed",
    (d) => `Payment confirmed for order ${d.orderNo ?? ""}`,
    (d) => (
      <Text style={emailStyles.p}>
        Your payment for order {String(d.orderNo ?? "")} is confirmed.
      </Text>
    ),
  ),
};

export async function renderEmailTemplate(
  templateName: string,
  data: Record<string, unknown>,
  siteUrl: string = defaultSiteUrl(),
  theme?: EmailTheme,
): Promise<{ html: string; text: string }> {
  const tpl = EMAIL_TEMPLATES[templateName];
  if (tpl) {
    return tpl.render(data, siteUrl, theme);
  }
  // Generic fallback
  const subject = String(data.subject ?? `Notification: ${templateName}`);
  return {
    html: `<p>${subject}</p>`,
    text: subject,
  };
}
