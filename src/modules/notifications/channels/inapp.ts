import type { TxCtx } from "@/lib/db";
import { type Notification, notifications } from "../../../../drizzle/schema/notifications";
import type { NotificationChannel, NotificationRecipient, RenderedNotification } from "../contracts";

export class InAppNotificationChannel implements NotificationChannel {
  readonly name = "inapp" as const;

  enabled(): boolean {
    return true;
  }

  async deliver(
    notification: Notification,
    rendered: RenderedNotification,
    recipient: NotificationRecipient,
    tx: TxCtx,
  ): Promise<void> {
    await tx.insert(notifications).values({
      userId: recipient.userId,
      type: notification.type,
      title: rendered.title,
      body: rendered.body,
      link: rendered.link,
      payload: notification.payload,
      channelState: { inapp: "sent" },
    });
  }
}
