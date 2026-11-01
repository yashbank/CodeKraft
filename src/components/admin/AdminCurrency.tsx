"use client";

import * as React from "react";

import type { RateTable } from "@/lib/currency-convert";
import {
  DEFAULT_ADMIN_CURRENCY,
  formatViewed,
  viewLocked,
  viewMoney,
  type AdminCurrencyConfig,
} from "@/lib/admin/currency-view";
import { format as formatMoney, type Currency, type Money } from "@/lib/money";
import type { MoneyLike } from "./types";

const Ctx = React.createContext<AdminCurrencyConfig>(DEFAULT_ADMIN_CURRENCY);

/** Mounted once by the admin layout with the signed-in admin's preferred currency + rate table. */
export function AdminCurrencyProvider({
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

export function useAdminCurrency(): AdminCurrencyConfig {
  return React.useContext(Ctx);
}

/**
 * Money formatters bound to the viewing admin's currency. `money`/`inr` return converted text
 * ("≈ €12.00" when converted); `original` returns the stored amount text when it differs
 * (for tooltips); `locked` converts a locked-INR ledger figure.
 */
export function useAdminMoney() {
  const cfg = useAdminCurrency();
  return React.useMemo(() => {
    const money = (m: MoneyLike) => formatViewed(viewMoney(m, cfg));
    return {
      currency: cfg.currency,
      money,
      inr: (amountMinor: number) => money({ amountMinor, currency: "INR" }),
      /** Stored amount text when it differs from what `money` shows, else undefined. */
      original: (m: MoneyLike): string | undefined => {
        const v = viewMoney(m, cfg);
        return v.original ? formatMoney(v.original) : undefined;
      },
      /** Converted amount in minor units (for sums/charts/CSV). */
      toViewer: (m: Money) => viewMoney(m, cfg).amountMinor,
      /** Stored amount exactly as posted (no conversion), for "native currency" views. */
      native: (m: MoneyLike) => formatMoney({ amountMinor: m.amountMinor, currency: m.currency }),
      /** Locked-INR-aware amount in viewer minor units (sign preserved), for running balances. */
      lockedToViewer: (m: Money, lockedInrMinor: number | undefined) =>
        Math.sign(m.amountMinor) *
        viewLocked(
          { ...m, amountMinor: Math.abs(m.amountMinor) },
          lockedInrMinor === undefined ? undefined : Math.abs(lockedInrMinor),
          cfg,
        ).amountMinor,
      locked: (m: MoneyLike, lockedInrMinor: number | undefined) =>
        formatViewed(viewLocked(m, lockedInrMinor, cfg)),
    };
  }, [cfg]);
}
