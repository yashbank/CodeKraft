/**
 * FX contracts — docs/06 API-FIN-12 (`refreshFxRates` admin trigger / `setFxOverride`), §3.3 daily
 * job `fx.refresh`, docs/04 §7.8. Re-exports the `FxProvider` port from `src/lib/fx.ts`
 * (P3.12 replaces `StaticFxProvider` with the `open.er-api.com` + `fx_rates` implementation).
 */
import { z } from "zod";
import type { RequestContext } from "@/lib/authz/context";
import type { DbOrTx, TxCtx } from "@/lib/db";
import type { Currency, Money } from "@/lib/money";
import type { FxQuote } from "@/lib/fx";
import { currencySchema, isoDateSchema } from "@/modules/_shared/zod";
import { FX_REFRESH_JOB_KEY, FX_SOURCES, type FxRateView, type FxRefreshResult } from "./types";

export {
  FX_SOURCE_STATIC,
  STATIC_FX_TABLE,
  StaticFxProvider,
  getFxProvider,
  getRate,
  setFxProvider,
} from "@/lib/fx";
export type { FxProvider, FxQuote } from "@/lib/fx";

export const fxSourceSchema = z.enum(FX_SOURCES);

/** Decimal string with up to 8 fraction digits, > 0 (`numeric(18,8)`). */
export const FX_RATE_PATTERN = /^(?!0+(?:\.0+)?$)\d{1,10}(?:\.\d{1,8})?$/;
export const fxRateStringSchema = z
  .string()
  .trim()
  .regex(FX_RATE_PATTERN, "positive decimal, ≤ 8 fraction digits");

/** API-FIN-12 `setFxOverride` — manual rate for `INR → quote` on a day (`source='manual'`). */
export const setFxOverrideSchema = z
  .strictObject({
    quote: currencySchema,
    rate: fxRateStringSchema,
    asOf: isoDateSchema,
  })
  .refine((i) => i.quote !== "INR", {
    message: "quote must differ from the INR base",
    path: ["quote"],
  });
export type SetFxOverrideInput = z.infer<typeof setFxOverrideSchema>;

/** API-FIN-12 `refreshFxRates` — admin trigger of the daily job. */
export const refreshFxRatesSchema = z.strictObject({
  /** Defaults to today (IST). */
  asOf: isoDateSchema.optional(),
});

/** Read used by pricing/reports: latest rate at or before `asOf`. */
export const getFxRateSchema = z.strictObject({
  base: currencySchema,
  quote: currencySchema,
  asOf: isoDateSchema.optional(),
});

/** Cron `fx.refresh` (docs/06 §3.3) — one run per daily window, guarded by `job_runs`. */
export interface FxRefreshJob {
  readonly key: typeof FX_REFRESH_JOB_KEY;
  /**
   * Fetch base INR from the provider, upsert `fx_rates` for every enabled currency (both
   * directions), and return the outcome. On provider failure keep the previous rates and set
   * `stale` when the last success is older than `FX_STALE_AFTER_DAYS` → `N: system.fx_stale`.
   */
  run(
    input: { asOf: string; currencies: readonly Currency[] },
    tx: TxCtx,
  ): Promise<FxRefreshResult>;
}

export interface FxService {
  /** API-FIN-12 (`settings.write`) — runs `FxRefreshJob.run` outside the cron window; audited. */
  refreshFxRates(
    ctx: RequestContext,
    input: z.infer<typeof refreshFxRatesSchema>,
    tx?: DbOrTx,
  ): Promise<{ rates: FxRateView[]; result: FxRefreshResult }>;
  /** API-FIN-12 (`settings.write`) — writes `fx_rates(source='manual')` for `INR/quote` and `quote/INR`. */
  setFxOverride(
    ctx: RequestContext,
    input: SetFxOverrideInput,
    tx?: DbOrTx,
  ): Promise<{ rates: FxRateView[] }>;
  /** Admin read of the current table (Settings → Currencies). */
  listRates(
    ctx: RequestContext,
    tx?: DbOrTx,
  ): Promise<{ rates: FxRateView[]; lastSuccessAt: string | null; stale: boolean }>;
  /** `FxProvider.getRate` backed by `fx_rates` (D-502); falls back to the static table when no row exists. */
  getRate(input: z.infer<typeof getFxRateSchema>, tx?: DbOrTx): Promise<FxQuote>;
  /** Convert money for display in the target currency with approx: true flag. */
  convertDisplay(
    money: Money,
    to: Currency,
    asOf?: Date,
    tx?: DbOrTx,
  ): Promise<{ money: Money; approx: boolean; rate: string }>;
  /** Look up rate to INR on a given date for P4 ledger entries (D-515). */
  rateToInrOn(currency: Currency, date: string | Date, tx?: DbOrTx): Promise<string>;
}
