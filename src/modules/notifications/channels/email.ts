/**
 * Email channel (D-1002, docs/12 §7): renders the notification into an `EmailMessage` and writes
 * an `email_outbox` row inside the caller's transaction (`channel_state.email = 'queued'`). The
 * actual send happens in `email.outbox_retry` (src/jobs/email-outbox.ts) with priority ordering
 * and the daily-cap deferral. The email `data` is the notification payload plus the rendered
 * `title`/`body`/`link` and the recipient's name, so every `src/emails` template finds what it needs.
 */
import type { TxCtx } from "@/lib/db";
import type { EmailMessage } from "@/lib/email/types";
import { moduleLogger } from "@/lib/logger";
import type { Notification } from "../../../../drizzle/schema/notifications";
import type { EmailNotificationChannel, NotificationRecipient } from "../contracts";
import { type OutboxAttachment, type TxEmailOutbox, getEmailOutbox } from "../outbox";
import { emailAllowedByPrefs } from "../prefs";
import type { NotificationType, RenderedNotification } from "../types";
import { setChannelState } from "./inapp";

const log = moduleLogger("notifications.email");

function attachmentsFromPayload(payload: unknown): EmailMessage["attachments"] | undefined {
  if (payload === null || typeof payload !== "object") return undefined;
  const raw = (payload as Record<string, unknown>)["emailAttachments"];
  if (!Array.isArray(raw)) return undefined;
  const out: NonNullable<EmailMessage["attachments"]> = [];
  for (const item of raw as Partial<OutboxAttachment>[]) {
    if (typeof item?.filename !== "string" || typeof item.contentBase64 !== "string") continue;
    out.push({
      filename: item.filename,
      content: Buffer.from(item.contentBase64, "base64"),
      ...(typeof item.contentType === "string" ? { contentType: item.contentType } : {}),
    });
  }
  return out.length > 0 ? out : undefined;
}

export interface EmailChannel extends EmailNotificationChannel {
  readonly outbox: TxEmailOutbox;
  /** Like `deliver`, but returns the outbox id (`null` when nothing was queued). */
  enqueue(
    notification: Notification,
    rendered: RenderedNotification,
    recipient: NotificationRecipient,
    tx: TxCtx,
  ): Promise<string | null>;
}

export function createEmailChannel(outbox: TxEmailOutbox = getEmailOutbox()): EmailChannel {
  const toEmailMessage: EmailChannel["toEmailMessage"] = (notification, rendered, recipient) => {
    if (rendered.emailTemplate === null) return null;
    if (!emailAllowedByPrefs(recipient.preferences, notification.type as NotificationType)) {
      return null;
    }
    const payload =
      notification.payload !== null && typeof notification.payload === "object"
        ? (notification.payload as Record<string, unknown>)
        : {};
    const { emailAttachments: _drop, ...data } = payload;
    const message: EmailMessage = {
      to: recipient.email,
      subject: rendered.title,
      template: rendered.emailTemplate,
      data: {
        ...data,
        title: rendered.title,
        body: rendered.body,
        link: rendered.link,
        recipientName: recipient.name,
        notificationId: notification.id,
        notificationType: notification.type,
      },
      priority: rendered.emailPriority,
    };
    const attachments = attachmentsFromPayload(payload);
    if (attachments !== undefined) message.attachments = attachments;
    return message;
  };

  const enqueue: EmailChannel["enqueue"] = async (notification, rendered, recipient, tx) => {
    const message = toEmailMessage(notification, rendered, recipient);
    if (message === null) {
      await setChannelState(tx, notification.id, { email: "skipped" });
      return null;
    }
    if (recipient.email.trim() === "" || recipient.email.endsWith("@phone.codekraft.invalid")) {
      await setChannelState(tx, notification.id, { email: "skipped" });
      return null;
    }
    try {
      const { id } = await outbox.enqueueIn(tx, message);
      await setChannelState(tx, notification.id, { email: "queued" });
      return id;
    } catch (err) {
      // Recipient-level problems never fail the domain transaction (contract): record and move on.
      log.error({ err, notificationId: notification.id }, "email outbox enqueue failed");
      await setChannelState(tx, notification.id, { email: "failed" });
      return null;
    }
  };

  return {
    name: "email",
    outbox,
    enabled: () => true,
    toEmailMessage,
    enqueue,
    async deliver(notification, rendered, recipient, tx) {
      await enqueue(notification, rendered, recipient, tx);
    },
  };
}
