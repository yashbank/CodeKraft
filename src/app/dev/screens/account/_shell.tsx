"use client";

import * as React from "react";

import { AccountShell, type AccountNavKey } from "@/components/account/AccountShell";
import type { Currency } from "@/lib/money";
import { customer, notifications, NOW } from "../_fixtures/account";
import { DEV_LINKS } from "./_links";

/** Account shell fed with fixtures; nav links point at the preview routes. */
export function PreviewShell({
  active,
  title,
  breadcrumb,
  minimal,
  children,
}: {
  active?: AccountNavKey;
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
  minimal?: { backHref: string; backLabel: string };
  children: React.ReactNode;
}) {
  const [currency, setCurrency] = React.useState<Currency>(customer.displayCurrency);
  return (
    <AccountShell
      user={customer}
      active={active}
      title={title}
      breadcrumb={breadcrumb}
      currency={currency}
      onCurrencyChange={setCurrency}
      notifications={notifications}
      unreadCount={notifications.filter((n) => !n.read).length}
      now={NOW}
      minimal={minimal}
      links={DEV_LINKS}
    >
      {children}
    </AccountShell>
  );
}
