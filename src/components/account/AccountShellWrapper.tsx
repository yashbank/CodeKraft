"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import { AccountShell, type AccountNavKey } from "./AccountShell";
import { Banner } from "./Banner";
import { ResendVerificationButton } from "./ResendVerificationButton";
import type { NotificationItem } from "./types";
import type { Currency } from "@/lib/money";

interface AccountShellWrapperProps {
  user: { name: string; email: string; initials: string };
  notifications?: NotificationItem[];
  unreadCount?: number;
  /** R8-08: false shows the "verify your email" banner (with resend) on every account page. */
  emailVerified?: boolean;
  children: React.ReactNode;
}

export function AccountShellWrapper({
  user,
  notifications = [],
  unreadCount = 0,
  emailVerified = true,
  children,
}: AccountShellWrapperProps) {
  const pathname = usePathname();
  const [currency, setCurrency] = React.useState<Currency>("INR");

  let active: AccountNavKey = "overview";
  if (pathname.startsWith("/account/purchases") || pathname.startsWith("/account/orders"))
    active = "purchases";
  else if (pathname.startsWith("/account/invoices")) active = "invoices";
  else if (pathname.startsWith("/account/queries")) active = "queries";
  else if (pathname.startsWith("/account/chat")) active = "chat";
  else if (pathname.startsWith("/account/wishlist")) active = "wishlist";
  else if (pathname.startsWith("/account/notifications")) active = "notifications";
  else if (pathname.startsWith("/account/settings")) active = "settings";

  return (
    <AccountShell
      user={user}
      active={active}
      currency={currency}
      onCurrencyChange={setCurrency}
      notifications={notifications}
      unreadCount={unreadCount}
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
      {children}
    </AccountShell>
  );
}
