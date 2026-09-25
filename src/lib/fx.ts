/**
 * FX provider port — docs/04 §7.8, D-502, D-515, PHASE-03 P3.12. Rates are decimal strings with eight decimals
 * (`numeric(18,8)`), never floats; convert with `lib/money.toInrMinor` / `convertMinor`.
 * Backed by `DatabaseFxProvider` reading `fx_rates` with fallback to `StaticFxProvider`.
 */
import type { Currency } from "./money";
import { isoDate } from "./dates";
import { AppError, ErrorCode } from "./errors";

export interface FxQuote {
  /** Decimal string, 8 fraction digits: 1 unit of `base` = `rate` units of `quote`. */
  rate: string;
  /** `YYYY-MM-DD` the rate applies to. */
  asOf: string;
  source: string;
}

export interface FxProvider {
  getRate(base: Currency, quote: Currency, asOf?: Date): Promise<FxQuote>;
}

export const FX_SOURCE_STATIC = "static";

/** Sample rates (September 2026 order of magnitude); both directions listed explicitly. */
export const STATIC_FX_TABLE: Readonly<Record<string, string>> = Object.freeze({
  "INR/USD": "0.01200000",
  "INR/EUR": "0.01100000",
  "INR/GBP": "0.00950000",
  "INR/CAD": "0.01630000",
  "USD/INR": "83.50000000",
  "EUR/INR": "90.90000000",
  "GBP/INR": "105.25000000",
  "CAD/INR": "61.35000000",
});

export class StaticFxProvider implements FxProvider {
  constructor(private readonly table: Readonly<Record<string, string>> = STATIC_FX_TABLE) {}

  getRate(base: Currency, quote: Currency, asOf: Date = new Date()): Promise<FxQuote> {
    const day = isoDate(asOf);
    if (base === quote) {
      return Promise.resolve({ rate: "1.00000000", asOf: day, source: FX_SOURCE_STATIC });
    }
    const rate = this.table[`${base}/${quote}`];
    if (rate === undefined) {
      return Promise.reject(
        new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, `No FX rate for ${base}/${quote}`),
      );
    }
    return Promise.resolve({ rate, asOf: day, source: FX_SOURCE_STATIC });
  }
}

export class DatabaseFxProvider implements FxProvider {
  async getRate(base: Currency, quote: Currency, asOf: Date = new Date()): Promise<FxQuote> {
    const day = isoDate(asOf);
    const { fxService } = await import("@/modules/fx/service");
    return fxService.getRate({ base, quote, asOf: day });
  }
}

let provider: FxProvider = new DatabaseFxProvider();

export function setFxProvider(next: FxProvider): void {
  provider = next;
}

export function getFxProvider(): FxProvider {
  return provider;
}

export function getRate(base: Currency, quote: Currency, asOf?: Date): Promise<FxQuote> {
  return provider.getRate(base, quote, asOf);
}
