/**
 * FX domain types — docs/05 §7 T-fx_rates, docs/04 §7.8, D-502, D-515, docs/06 §3.3 job `fx.refresh`.
 * Rates are `numeric(18,8)` decimal strings; conversions go through `lib/money` only.
 */
import type { Currency } from "@/lib/money";

export type { FxRate } from "../../../drizzle/schema/settings";
export type { FxProvider, FxQuote } from "@/lib/fx";

/** `fx_rates.source` values. */
export const FX_SOURCES = ["static", "open.er-api.com", "manual"] as const;
export type FxSource = (typeof FX_SOURCES)[number];

/** Daily-job key (docs/06 §3.3, docs/12 §2.3). */
export const FX_REFRESH_JOB_KEY = "fx.refresh";
/** `N: system.fx_stale` when the last successful fetch is older than this (docs/06 §3.3). */
export const FX_STALE_AFTER_DAYS = 3;
/** Provider base currency: rates are fetched base INR (docs/06 §3.3). */
export const FX_FETCH_BASE: Currency = "INR";

export interface FxRateView {
  base: Currency;
  quote: Currency;
  /** Decimal string, 8 fraction digits. */
  rate: string;
  /** `YYYY-MM-DD` */
  asOf: string;
  source: FxSource;
  createdAt: string;
}

export interface FxRefreshResult {
  asOf: string;
  source: FxSource;
  /** Rows upserted (both directions per quote currency). */
  written: number;
  /** Set when the provider failed and the previous rates were kept. */
  error?: string;
  stale: boolean;
}
