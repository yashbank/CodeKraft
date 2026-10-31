/**
 * Admin multi-currency display (pure, client-safe). Stored amounts are never rewritten: every admin
 * number is converted to the *viewing admin's* preferred currency (users.display_currency) for
 * display, with the stored original available as secondary text. Conversion goes through one
 * `RateTable` (src/lib/currency-convert.ts); A1's `modules/fx/convert.ts` supplies the live table.
 * Historical ledger/expense rows already carry a locked INR amount, so they convert from that INR
 * figure (`viewLocked`), pending/display amounts convert from their own currency (`viewMoney`).
 */
import { convertWithTable, type RateTable } from "@/lib/currency-convert";
import { format as formatMoney, isCurrency, type Currency, type Money } from "@/lib/money";

export interface AdminCurrencyConfig {
  currency: Currency;
  table: RateTable;
}

/** Static last-resort table (units per 1 INR) so a missing provider never crashes admin pages. */
export const FALLBACK_RATE_TABLE: RateTable = {
  base: "INR",
  rates: { INR: "1", USD: "0.012", EUR: "0.011", GBP: "0.0095", CAD: "0.0163" },
  fetchedAt: "static",
  stale: true,
  source: "static",
};

export const DEFAULT_ADMIN_CURRENCY: AdminCurrencyConfig = {
  currency: "INR",
  table: FALLBACK_RATE_TABLE,
};

export function resolveAdminCurrency(pref: unknown): Currency {
  return isCurrency(pref) ? pref : "INR";
}

export interface ViewedMoney {
  /** Amount in the viewer's currency. */
  amountMinor: number;
  currency: Currency;
  /** True when converted (stored currency differs from the viewer's). */
  approx: boolean;
  /** Stored amount, only when it differs from the displayed one. */
  original?: Money;
}

/** Convert a stored (amountMinor, currency) to the viewer's currency at the current table. */
export function viewMoney(m: Money, cfg: AdminCurrencyConfig): ViewedMoney {
  if (m.currency === cfg.currency) {
    return { amountMinor: m.amountMinor, currency: m.currency, approx: false };
  }
  return {
    amountMinor: convertWithTable(m.amountMinor, m.currency, cfg.currency, cfg.table),
    currency: cfg.currency,
    approx: true,
    original: { amountMinor: m.amountMinor, currency: m.currency },
  };
}

/**
 * Convert a ledger/expense row using its *locked* INR amount (rate fixed at posting), then
 * INR -> viewer at the current table. Falls back to the live table when no locked INR is known.
 */
export function viewLocked(
  m: Money,
  lockedInrMinor: number | undefined,
  cfg: AdminCurrencyConfig,
): ViewedMoney {
  if (m.currency === cfg.currency) {
    return { amountMinor: m.amountMinor, currency: m.currency, approx: false };
  }
  if (lockedInrMinor === undefined) return viewMoney(m, cfg);
  return {
    amountMinor: convertWithTable(lockedInrMinor, "INR", cfg.currency, cfg.table),
    currency: cfg.currency,
    approx: true,
    original: { amountMinor: m.amountMinor, currency: m.currency },
  };
}

/** "₹1,200.00" or, when converted, "≈ €12.00". */
export function formatViewed(v: ViewedMoney): string {
  const text = formatMoney({ amountMinor: v.amountMinor, currency: v.currency });
  return v.approx ? `≈ ${text}` : text;
}

/** Sum amounts of mixed currencies in the viewer's currency (each converted, then added). */
export function sumInViewerCurrency(items: readonly Money[], cfg: AdminCurrencyConfig): Money {
  let total = 0;
  for (const m of items) total += viewMoney(m, cfg).amountMinor;
  return { amountMinor: total, currency: cfg.currency };
}
