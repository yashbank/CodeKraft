import { NotificationsInbox } from "@/components/admin/system/NotificationsInbox";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapNotificationItem } from "@/lib/admin/notifications-view";
import { listNotificationsQuery } from "@/modules/notifications/queries";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const ctx = await getAdminRequestContext();
  const result = await listNotificationsQuery({ limit: 100 }, ctx);
  const notifications = result.ok ? result.data.items.map(mapNotificationItem) : [];

  return <NotificationsInbox notifications={notifications} now={new Date().toISOString()} />;
}
