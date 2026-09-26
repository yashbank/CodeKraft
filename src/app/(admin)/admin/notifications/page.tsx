import { NotificationsInbox } from "@/components/admin/system/NotificationsInbox";
import { NOTIFICATIONS } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminNotificationsPage() {
  return (
    <NotificationsInbox
      notifications={NOTIFICATIONS}
      now={new Date().toISOString()}
    />
  );
}
