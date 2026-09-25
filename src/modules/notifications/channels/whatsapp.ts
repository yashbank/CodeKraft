/**
 * WhatsApp channel — interface-only stub behind the `whatsapp_channel` flag (D-1604, docs/13 §6).
 * `enabled()` reflects the flag as last resolved by the service; `deliver` records that the
 * channel is not wired yet and never throws (no provider in release 1).
 */
import type { TxCtx } from "@/lib/db";
import { moduleLogger } from "@/lib/logger";
import type { Notification } from "../../../../drizzle/schema/notifications";
import type { NotificationChannel, NotificationRecipient } from "../contracts";
import type { RenderedNotification } from "../types";
import { setChannelState } from "./inapp";

const log = moduleLogger("notifications.whatsapp");

export interface WhatsAppChannel extends NotificationChannel {
  setEnabled(enabled: boolean): void;
}

export function createWhatsAppChannel(initiallyEnabled = false): WhatsAppChannel {
  let enabled = initiallyEnabled;
  return {
    name: "whatsapp",
    enabled: () => enabled,
    setEnabled(next) {
      enabled = next;
    },
    async deliver(
      notification: Notification,
      _rendered: RenderedNotification,
      recipient: NotificationRecipient,
      tx: TxCtx,
    ) {
      if (!enabled) {
        await setChannelState(tx, notification.id, { whatsapp: "skipped" });
        return;
      }
      log.info(
        { notificationId: notification.id, userId: recipient.userId },
        "whatsapp channel stub: no provider configured (release 1)",
      );
      await setChannelState(tx, notification.id, { whatsapp: "skipped" });
    },
  };
}
