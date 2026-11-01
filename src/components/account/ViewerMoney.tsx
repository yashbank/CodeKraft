"use client";

import * as React from "react";

import { DEFAULT_ADMIN_CURRENCY, formatViewed, viewMoney } from "@/lib/admin/currency-view";
import type { AdminCurrencyConfig } from "@/lib/admin/currency-view";
import type { RateTable } from "@/lib/currency-convert";
import { format, type Currency, type Money } from "@/lib/money";

const Ctx = React.createContext<AdminCurrencyConfig>(DEFAULT_ADMIN_CURRENCY);

/** Mounted by the account layout: the visitor's display currency + the server rate table. */
export function ViewerCurrencyProvider({
  currency,
  table,
  children,
}: {
  currency: Currency;
  table: RateTable;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ currency, table }), [currency, table]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Money text in the viewer's currency. When the stored currency differs: "≈ $12.01 · charged
 * ₹1,001.00" (`withCharged` adds the stored amount; line items omit it). Same currency: plain amount.
 */
export function useViewerFormat(): (m: Money, withCharged?: boolean) => string {
  const cfg = React.useContext(Ctx);
  return React.useCallback(
    (m, withCharged) => {
      const v = viewMoney(m, cfg);
      const text = formatViewed(v);
      return v.original && withCharged ? `${text} · charged ${format(v.original)}` : text;
    },
    [cfg],
  );
}
