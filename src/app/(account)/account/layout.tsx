import { redirectToLogin } from "@/lib/authz/login-redirect";
import { getSession } from "@/modules/auth/service";
import { mapNotificationItem } from "@/lib/account/notifications-view";
import { listNotificationsQuery } from "@/modules/notifications/queries";
import { getDisplayCurrency } from "@/lib/display-currency";
import { ThemeSync } from "@/components/site/ThemeSync";
import { getThemeConfig } from "@/lib/site-brand";
import { isThemePref } from "@/lib/theme";
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

  const [display, { themeToggle }] = await Promise.all([getDisplayCurrency(), getThemeConfig()]);
  const themePref = (session.user as { themePref?: string | null }).themePref;

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
      themeToggle={themeToggle}
      currency={display.currency}
      currencyOptions={display.enabled}
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
      {themeToggle ? <ThemeSync pref={isThemePref(themePref) ? themePref : null} /> : null}
      {children}
    </AccountShellWrapper>
  );
}
