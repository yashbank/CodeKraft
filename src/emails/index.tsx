import React from "react";
import { render } from "@react-email/components";
import { EmailLayout, emailStyles } from "@/lib/email/render";
import { Text, Link } from "@react-email/components";

export interface RenderTemplateOptions {
  siteUrl?: string;
  data: Record<string, unknown>;
}

export interface EmailTemplateDefinition {
  name: string;
  render: (data: Record<string, unknown>, siteUrl: string) => Promise<{ html: string; text: string }>;
}

function makeTemplate(name: string, subjectFn: (data: any) => string, bodyFn: (data: any) => React.ReactNode): EmailTemplateDefinition {
  return {
    name,
    async render(data: Record<string, unknown>, siteUrl: string) {
      const subject = subjectFn(data);
      const element = (
        <EmailLayout preview={subject} title={subject} siteUrl={siteUrl}>
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
        <Link href={d.url as string} style={emailStyles.button}>Verify Email</Link>
      </>
    ),
  ),
  "reset-password": makeTemplate(
    "reset-password",
    () => "Reset your CodeKraft password",
    (d) => (
      <>
        <Text style={emailStyles.p}>Use this button to reset your password:</Text>
        <Link href={d.url as string} style={emailStyles.button}>Reset Password</Link>
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
        <Text style={emailStyles.p}>Order #{d.orderNumber ?? ""} is awaiting payment.</Text>
        <Text style={emailStyles.p}>Please complete payment via UPI or Bank transfer and submit your reference.</Text>
        {d.url && <Link href={d.url as string} style={emailStyles.button}>Submit Payment Reference</Link>}
      </>
    ),
  ),
  "payment-submitted-ack": makeTemplate(
    "payment-submitted-ack",
    (d) => `Payment Reference Received #${d.orderNumber ?? ""}`,
    (d) => (
      <Text style={emailStyles.p}>We have received your payment reference. An administrator will verify it shortly.</Text>
    ),
  ),
  "payment-confirmed-invoice": makeTemplate(
    "payment-confirmed-invoice",
    (d) => `Payment Confirmed & Invoice #${d.orderNumber ?? ""}`,
    (d) => (
      <>
        <Text style={emailStyles.p}>Your payment has been verified and your purchase is ready.</Text>
        <Link href="/account/purchases" style={emailStyles.button}>View Purchases</Link>
      </>
    ),
  ),
  "delivery-license-key": makeTemplate(
    "delivery-license-key",
    (d) => `License Ready: ${d.productTitle ?? "Product"}`,
    (d) => (
      <>
        <Text style={emailStyles.p}>Your license key has been generated and is ready in your customer portal.</Text>
        <Text style={emailStyles.muted}>For security reasons, license keys are never sent over email. Please view and reveal your key in your portal.</Text>
        <Link href="/account/purchases" style={emailStyles.button}>View License Key in Portal</Link>
      </>
    ),
  ),
  "subscription-reminder": makeTemplate(
    "subscription-reminder",
    (d) => `Upcoming Subscription Renewal: ${d.productTitle ?? "Subscription"}`,
    (d) => (
      <Text style={emailStyles.p}>Your subscription is scheduled to renew soon. Please ensure your payment method or reference is up to date.</Text>
    ),
  ),
  "query-reply": makeTemplate(
    "query-reply",
    (d) => `Reply to Query: ${d.subject ?? "Support Request"}`,
    (d) => (
      <>
        <Text style={emailStyles.p}>Our team has replied to your support query.</Text>
        <Link href={d.url as string ?? "/account/queries"} style={emailStyles.button}>View Reply</Link>
      </>
    ),
  ),
  "query-closed": makeTemplate(
    "query-closed",
    (d) => `Query Closed: ${d.subject ?? "Support Request"}`,
    (d) => (
      <Text style={emailStyles.p}>Your query thread has been marked as closed. You can submit a new query at any time.</Text>
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
        <Link href="/admin/leads?overdue=true" style={emailStyles.button}>Open Admin Dashboard</Link>
      </>
    ),
  ),
  "refund-issued": makeTemplate(
    "refund-issued",
    (d) => `Credit Note Issued #${d.creditNoteNumber ?? ""}`,
    (d) => (
      <Text style={emailStyles.p}>Your refund has been approved and a credit note has been issued.</Text>
    ),
  ),
};

export async function renderEmailTemplate(
  templateName: string,
  data: Record<string, unknown>,
  siteUrl: string = "https://codekraft.in",
): Promise<{ html: string; text: string }> {
  const tpl = EMAIL_TEMPLATES[templateName];
  if (tpl) {
    return tpl.render(data, siteUrl);
  }
  // Generic fallback
  const subject = String(data.subject ?? `Notification: ${templateName}`);
  return {
    html: `<p>${subject}</p>`,
    text: subject,
  };
}
