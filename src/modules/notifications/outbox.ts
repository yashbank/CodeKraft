/**
 * `EmailOutboxPort` against `email_outbox` (docs/05 §11, docs/12 §7, P1.8 `setEmailOutbox`).
 *
 * A row is `queued` with `priority` (1 urgent … 9 digest); `email.outbox_retry` (src/jobs/email-outbox.ts)
 * sends it through the real transport with back-off (5 attempts) and the 90/day deferral. The
 * `payload` column stores `{ subject, data, attachments? }`; Buffer attachments are base64-encoded
 * so the row is plain JSON.
 */
import { type DbOrTx, type TxCtx, getDb } from "@/lib/db";
import type { EmailMessage, EmailOutboxPort, EmailTemplate } from "@/lib/email/types";
import { setEmailOutbox } from "@/lib/email/transport";
import { type EmailOutboxRow, emailOutbox } from "../../../drizzle/schema/notifications";

export interface OutboxAttachment {
  filename: string;
  contentBase64: string;
  contentType?: string;
}

export interface OutboxPayload {
  subject: string;
  data: Record<string, unknown>;
  attachments?: OutboxAttachment[];
}

export const DEFAULT_EMAIL_PRIORITY = 5;

export function clampPriority(priority: number | undefined): number {
  if (priority === undefined || !Number.isFinite(priority)) return DEFAULT_EMAIL_PRIORITY;
  return Math.min(9, Math.max(1, Math.round(priority)));
}

export function toOutboxPayload(message: EmailMessage): OutboxPayload {
  const payload: OutboxPayload = { subject: message.subject, data: message.data };
  if (message.attachments !== undefined && message.attachments.length > 0) {
    payload.attachments = message.attachments.map((a) => ({
      filename: a.filename,
      contentBase64: Buffer.isBuffer(a.content)
        ? a.content.toString("base64")
        : Buffer.from(a.content, "utf8").toString("base64"),
      ...(a.contentType === undefined ? {} : { contentType: a.contentType }),
    }));
  }
  return payload;
}

/** Inverse of `toOutboxPayload`: rebuild the `EmailMessage` the job hands to the transport. */
export function fromOutboxRow(row: EmailOutboxRow): EmailMessage {
  const raw = (row.payload ?? {}) as Partial<OutboxPayload>;
  const message: EmailMessage = {
    to: row.toEmail,
    subject: typeof raw.subject === "string" ? raw.subject : row.template,
    template: row.template as EmailTemplate,
    data: raw.data !== null && typeof raw.data === "object" ? raw.data : {},
    priority: row.priority,
  };
  if (Array.isArray(raw.attachments) && raw.attachments.length > 0) {
    message.attachments = raw.attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.contentBase64, "base64"),
      ...(a.contentType === undefined ? {} : { contentType: a.contentType }),
    }));
  }
  return message;
}

/** Transaction-aware outbox: `enqueue` on the root client, `enqueueIn` inside the caller's `tx`. */
export interface TxEmailOutbox extends EmailOutboxPort {
  enqueueIn(tx: TxCtx, message: EmailMessage): Promise<{ id: string }>;
}

export function createEmailOutbox(db: () => DbOrTx = () => getDb()): TxEmailOutbox {
  const insert = async (handle: DbOrTx, message: EmailMessage) => {
    const [row] = await handle
      .insert(emailOutbox)
      .values({
        toEmail: message.to,
        template: message.template,
        payload: toOutboxPayload(message),
        priority: clampPriority(message.priority),
      })
      .returning({ id: emailOutbox.id });
    if (row === undefined) throw new Error("email_outbox insert returned no row");
    return { id: row.id };
  };
  return {
    enqueue: (message) => insert(db(), message),
    enqueueIn: (tx, message) => insert(tx, message),
  };
}

let registered: TxEmailOutbox | undefined;

/** Idempotent: wires the DB outbox into `lib/email/transport` (`EMAIL_TRANSPORT=outbox`). */
export function registerEmailOutbox(outbox: TxEmailOutbox = createEmailOutbox()): TxEmailOutbox {
  registered = outbox;
  setEmailOutbox(outbox);
  return outbox;
}

export function getEmailOutbox(): TxEmailOutbox {
  registered ??= registerEmailOutbox();
  return registered;
}
