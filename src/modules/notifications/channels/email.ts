import type { TxCtx } from "@/lib/db";
import type { EmailMessage, EmailOutboxPort } from "@/lib/email/types";
import { type Notification, emailOutbox } from "../../../../drizzle/schema/notifications";
import type {
  EmailNotificationChannel,
  NotificationRecipient,
  RenderedNotification,
} from "../contracts";

export class DefaultEmailNotificationChannel implements EmailNotificationChannel {
  readonly name = "email" as const;
  readonly outbox: EmailOutboxPort;

  constructor(outboxPort?: EmailOutboxPort) {
    this.outbox = outboxPort ?? {
      async enqueue(msg: EmailMessage) {
        return { id: "outbox-noop" };
      },
    };
  }

  enabled(): boolean {
    return true;
  }

  toEmailMessage(
    notification: Notification,
    rendered: RenderedNotification,
    recipient: NotificationRecipient,
  ): EmailMessage | null {
    if (!rendered.emailTemplate) return null;

    // Check preferences if present
    if (recipient.preferences?.email) {
      if (
        notification.type === "product.updated" &&
        recipient.preferences.email.productUpdates === false
      ) {
        return null;
      }
    }

    return {
      to: recipient.email,
      subject: rendered.title,
      template: rendered.emailTemplate,
      data: (notification.payload as Record<string, unknown>) ?? {},
      priority: rendered.emailPriority ?? 5,
    };
  }

  async deliver(
    notification: Notification,
    rendered: RenderedNotification,
    recipient: NotificationRecipient,
    tx: TxCtx,
  ): Promise<void> {
    const message = this.toEmailMessage(notification, rendered, recipient);
    if (!message) return;

    await tx.insert(emailOutbox).values({
      toEmail: message.to,
      template: message.template,
      payload: message.data,
      priority: message.priority ?? 5,
      status: "queued",
      attempts: 0,
    });
  }
}
