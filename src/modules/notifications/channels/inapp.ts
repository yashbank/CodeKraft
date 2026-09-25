/**
 * In-app channel (D-707): the `notifications` row is the delivery itself; this channel only
 * records `channel_state.inapp = 'sent'`. Never throws for recipient-level problems.
 */
import { eq, sql } from "drizzle-orm";
import type { TxCtx } from "@/lib/db";
import { type Notification, notifications } from "../../../../drizzle/schema/notifications";
import type { NotificationChannel, NotificationRecipient } from "../contracts";
import type { RenderedNotification } from "../types";

export async function setChannelState(
  tx: TxCtx,
  notificationId: string,
  patch: Record<string, string>,
): Promise<void> {
  await tx
    .update(notifications)
    .set({ channelState: sql`coalesce(${notifications.channelState}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(notifications.id, notificationId));
}

export function createInAppChannel(): NotificationChannel {
  return {
    name: "inapp",
    enabled: () => true,
    async deliver(
      notification: Notification,
      _rendered: RenderedNotification,
      _recipient: NotificationRecipient,
      tx: TxCtx,
    ) {
      await setChannelState(tx, notification.id, { inapp: "sent" });
    },
  };
}
