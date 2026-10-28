import { redirectToLogin } from "@/lib/authz/login-redirect";
import { getSession } from "@/modules/auth/service";
import { mapNotificationItem } from "@/lib/account/notifications-view";
import { listNotificationsQuery } from "@/modules/notifications/queries";
import { AccountShellWrapper } from "@/components/account/AccountShellWrapper";

export const dynamic = "force-dynamic";

export default async function AccountAreaLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    return redirectToLogin("/account");
  }

  const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
  const notificationsRes = await listNotificationsQuery(
    { limit: 8 },
    await getSiteRequestContext(),
  );

  const name: string =
    session.user.name ||
    (session.user.email ? session.user.email.split("@")[0] : "Customer") ||
    "Customer";

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AccountShellWrapper
      notifications={
        notificationsRes.ok ? notificationsRes.data.items.map(mapNotificationItem) : []
      }
      unreadCount={notificationsRes.ok ? notificationsRes.data.unreadCount : 0}
      emailVerified={Boolean(session.user.emailVerified)}
      user={{
        name,
        email: session.user.email,
        initials,
      }}
    >
      {children}
    </AccountShellWrapper>
  );
}
