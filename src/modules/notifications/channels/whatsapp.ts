import type { TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import type { Notification } from "../../../../drizzle/schema/notifications";
import type { NotificationChannel, NotificationRecipient } from "../contracts";
import type { RenderedNotification } from "../types";

export class WhatsAppNotificationChannel implements NotificationChannel {
  readonly name = "whatsapp" as const;

  enabled(): boolean {
    return process.env.FEATURE_WHATSAPP_CHANNEL === "true";
  }

  async deliver(
    _notification: Notification,
    _rendered: RenderedNotification,
    _recipient: NotificationRecipient,
    _tx: TxCtx,
  ): Promise<void> {
    if (!this.enabled()) {
      throw new AppError(ErrorCode.VALIDATION, "WhatsApp channel is disabled in this environment");
    }
  }
}
