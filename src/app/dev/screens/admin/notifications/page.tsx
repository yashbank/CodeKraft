import { NotificationsInbox } from "@/components/admin/system/NotificationsInbox";
import { NOTIFICATIONS, NOW } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-33 · Notifications inbox" };

export default function Page() {
  return (
    <PreviewShell active="/notifications" title="Notifications" readMostly>
      <NotificationsInbox notifications={NOTIFICATIONS} now={NOW} />
    </PreviewShell>
  );
}
