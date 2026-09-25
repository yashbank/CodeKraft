export type EmailTemplate =
  | "verify-email"
  | "reset-password"
  | "change-email"
  | "one-time-login"
  | "phone-otp"
  | "order-created-instructions"
  | "payment-submitted-ack"
  | "payment-confirmed-invoice"
  | "delivery-saas-credentials"
  | "delivery-license-key"
  | "query-reply"
  | "query-closed"
  | "subscription-reminder"
  | "refund-issued"
  | "admin-overdue-digest";

export interface EmailMessage {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
  /** 1 = urgent (auth, payment), 5 = default, 9 = digest; the outbox defers low priority near the daily cap. */
  priority?: number;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}

export interface EmailSendResult {
  transport: "log" | "outbox" | "resend";
  id?: string;
  skipped?: "allowlist" | "daily_cap";
}

/** P2 supplies the `email_outbox` table; P6 the channel. */
export interface EmailOutboxPort {
  enqueue(message: EmailMessage): Promise<{ id: string }>;
}
