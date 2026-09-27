import { NotificationsScreen } from "@/components/account/NotificationsScreen";
import { mapNotificationItem } from "@/lib/account/notifications-view";
import { listNotificationsQuery } from "@/modules/notifications/queries";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
  const ctx = await getSiteRequestContext();

  const result = await listNotificationsQuery({ limit: 100 }, ctx);
  const items = result.ok ? result.data.items.map(mapNotificationItem) : [];

  return (
    <NotificationsScreen
      items={items}
      now={new Date().toISOString()}
      links={{
        settings: "/account/settings",
      }}
    />
  );
}
