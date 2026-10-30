"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { AccountShell, type AccountNavKey } from "./AccountShell";
import { KeyboardShortcutsSheet } from "@/components/admin/KeyboardShortcutsSheet";
import { Banner } from "./Banner";
import { ResendVerificationButton } from "./ResendVerificationButton";
import type { NotificationItem } from "./types";
import { CURRENCY_COOKIE } from "@/lib/currency-prefs";
import { usePolling } from "@/lib/use-polling";
import type { Currency } from "@/lib/money";
import { updateMyAccountSettings } from "@/modules/users/site-mutations";
import { markAllMyNotificationsRead } from "@/modules/notifications/site-mutations";

/** Re-fetch server state (bell, badge, inbox share it) while the tab is visible. */
const NOTIFICATION_POLL_MS = 60_000;

interface AccountShellWrapperProps {
  user: { name: string; email: string; initials: string };
  notifications?: NotificationItem[];
  unreadCount?: number;
  /** R8-08: false shows the "verify your email" banner (with resend) on every account page. */
  emailVerified?: boolean;
  currency?: Currency;
  currencyOptions?: readonly Currency[];
  themeToggle?: boolean;
  children: React.ReactNode;
}

export function AccountShellWrapper({
  user,
  notifications = [],
  unreadCount = 0,
  emailVerified = true,
  currency = "INR",
  currencyOptions,
  themeToggle,
  children,
}: AccountShellWrapperProps) {
  const pathname = usePathname();
  const router = useRouter();
  usePolling(
    async () => {
      router.refresh();
      return "ok";
    },
    { intervalMs: NOTIFICATION_POLL_MS },
  );

  let active: AccountNavKey = "overview";
  if (pathname.startsWith("/account/purchases") || pathname.startsWith("/account/orders"))
    active = "purchases";
  else if (pathname.startsWith("/account/invoices")) active = "invoices";
  else if (pathname.startsWith("/account/queries")) active = "queries";
  else if (pathname.startsWith("/account/quotes") || pathname.startsWith("/quote/"))
    active = "quotes";
  else if (pathname.startsWith("/account/chat")) active = "chat";
  else if (pathname.startsWith("/account/wishlist")) active = "wishlist";
  else if (pathname.startsWith("/account/notifications")) active = "notifications";
  else if (pathname.startsWith("/account/settings")) active = "settings";

  return (
    <AccountShell
      user={user}
      active={active}
      currency={currency}
      currencyOptions={currencyOptions}
      themeToggle={themeToggle}
      onCurrencyChange={(c) => {
        document.cookie = `${CURRENCY_COOKIE}=${c}; path=/; max-age=31536000; samesite=lax`;
        void updateMyAccountSettings({ displayCurrency: c }).finally(() => router.refresh());
      }}
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkAllRead={() => void markAllMyNotificationsRead()}
      now={new Date().toISOString()}
    >
      {/* The overview renders its own verification banner; chat shows an inline one. */}
      {!emailVerified && pathname !== "/account" && !pathname.startsWith("/account/chat") ? (
        <Banner
          tone="warning"
          title="Verify your email"
          className="mb-6"
          action={
            <ResendVerificationButton
              email={user.email}
              label="Resend"
              size="sm"
              variant="secondary"
            />
          }
        >
          We sent a link to {user.email}. Purchases, payments and the assistant unlock once
          it&apos;s verified.
        </Banner>
      ) : null}
      <KeyboardShortcutsSheet area="account" />
      {children}
    </AccountShell>
  );
}
