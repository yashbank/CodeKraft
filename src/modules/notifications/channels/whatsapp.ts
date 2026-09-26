import type { TxCtx } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Notification } from "../../../../drizzle/schema/notifications";
import type { NotificationChannel, NotificationRecipient, RenderedNotification } from "../contracts";

export class WhatsAppNotificationChannel implements NotificationChannel {
  readonly name = "whatsapp" as const;

  enabled(): boolean {
    return process.env.FEATURE_WHATSAPP_CHANNEL === "true";
  }

  async deliver(
    notification: Notification,
    rendered: RenderedNotification,
    recipient: NotificationRecipient,
    tx: TxCtx,
  ): Promise<void> {
    if (!this.enabled()) {
      throw new AppError("BAD_REQUEST", "WhatsApp channel is disabled in this environment");
    }
  }
}
