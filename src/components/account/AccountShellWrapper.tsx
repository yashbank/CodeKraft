"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import { AccountShell, type AccountNavKey } from "./AccountShell";
import type { NotificationItem } from "./types";
import type { Currency } from "@/lib/money";

interface AccountShellWrapperProps {
  user: { name: string; email: string; initials: string };
  notifications?: NotificationItem[];
  unreadCount?: number;
  children: React.ReactNode;
}

export function AccountShellWrapper({
  user,
  notifications = [],
  unreadCount = 0,
  children,
}: AccountShellWrapperProps) {
  const pathname = usePathname();
  const [currency, setCurrency] = React.useState<Currency>("INR");

  let active: AccountNavKey = "overview";
  if (pathname.startsWith("/account/purchases")) active = "purchases";
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
      {children}
    </AccountShell>
  );
}
