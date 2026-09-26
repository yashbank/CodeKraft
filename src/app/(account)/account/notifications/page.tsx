import { NotificationsScreen } from "@/components/account/NotificationsScreen";
import { notifications } from "@/app/dev/screens/_fixtures/account";

export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  return (
    <NotificationsScreen
      items={notifications}
      now={new Date().toISOString()}
      links={{
        settings: "/account/settings",
      }}
    />
  );
}
