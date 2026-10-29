/**
 * Expense FX lock (P9-02). Chain: locked (unless refresh) -> manual -> live (timeout) -> stored
 * fx_rates row (< 7 days, flagged) -> VALIDATION error asking for a manual rate. Never silently 1:1.
 */
import { and, desc, eq } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { divRoundHalfUp, parseDecimalScaled, type Currency } from "@/lib/money";
import { fxRates } from "../../../drizzle/schema/settings";
import { fetchOpenErRates, invertRate, to8DecimalString } from "./client";

export const EXPENSE_FX_TIMEOUT_MS = 5000;
export const EXPENSE_FX_STORED_MAX_AGE_DAYS = 7;
export const STORED_PREFIX = "stored:";

export interface LockedRate {
  /** 1 unit of the expense currency = `rate` INR (8 decimals). */
  rate: string;
  /** `open.er-api.com` | `stored:<src>` | `manual` | `base`. */
  source: string;
  /** ISO timestamp the rate was fetched / entered. */
  at: string;
}

export interface ResolveExpenseRateOptions {
  currency: Currency;
  db: DbOrTx;
  manualRate?: string | undefined;
  locked?: LockedRate | null | undefined;
  /** Explicit "Refresh rate": ignore `locked`. */
  refresh?: boolean | undefined;
  now?: Date;
  fetchFn?: typeof fetch;
}

export async function resolveExpenseRate(o: ResolveExpenseRateOptions): Promise<LockedRate> {
  const now = o.now ?? new Date();
  if (o.currency === "INR") return { rate: "1.00000000", source: "base", at: now.toISOString() };
  if (o.locked && !o.refresh) return o.locked;
  if (o.manualRate) {
    return { rate: to8DecimalString(o.manualRate), source: "manual", at: now.toISOString() };
  }

  try {
    const doFetch = o.fetchFn ?? fetch;
    const { rates } = await fetchOpenErRates(undefined, (url, init) =>
      doFetch(url, { ...init, signal: AbortSignal.timeout(EXPENSE_FX_TIMEOUT_MS) }),
    );
    const inrToX = rates[o.currency];
    if (inrToX) {
      const host = process.env.FX_API_URL
        ? new URL(process.env.FX_API_URL).host
        : "open.er-api.com";
      return { rate: invertRate(inrToX), source: host, at: now.toISOString() };
    }
  } catch {
    // fall through to the stored rate
  }

  const [row] = await o.db
    .select()
    .from(fxRates)
    .where(and(eq(fxRates.base, o.currency), eq(fxRates.quote, "INR")))
    .orderBy(desc(fxRates.asOf), desc(fxRates.createdAt))
    .limit(1);
  if (row && now.getTime() - row.createdAt.getTime() < EXPENSE_FX_STORED_MAX_AGE_DAYS * 864e5) {
    return {
      rate: row.rate,
      source: `${STORED_PREFIX}${row.source}`,
      at: row.createdAt.toISOString(),
    };
  }

  throw new AppError(
    ErrorCode.VALIDATION,
    `No current ${o.currency}/INR rate is available. Enter the rate manually.`,
    { fieldErrors: { manualRate: [`Enter the rate: 1 ${o.currency} = ? INR`] } },
  );
}

/** `amountMinor × rate` into base minor units; `fromDigits`/`toDigits` handle e.g. JPY (0) -> INR (2). */
export function toBaseMinor(
  amountMinor: number,
  rate: string,
  fromDigits = 2,
  toDigits = 2,
): number {
  const scaled = BigInt(amountMinor) * parseDecimalScaled(rate, 8) * 10n ** BigInt(toDigits);
  return Number(divRoundHalfUp(scaled, 10n ** BigInt(8 + fromDigits)));
}

/** "1 USD = 83.12 INR (open.er-api.com, 29 Oct 2026 10:12 UTC)"; stored rates are flagged. */
export function formatRateLine(currency: string, l: LockedRate): string {
  const [w = "0", f = ""] = l.rate.split(".");
  const rate = `${w}.${f.replace(/0+$/, "").padEnd(2, "0")}`;
  const d = new Date(l.at);
  const when =
    `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()} ` +
    `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
  const src = l.source.startsWith(STORED_PREFIX)
    ? `stored rate, ${l.source.slice(STORED_PREFIX.length)}`
    : l.source;
  return `1 ${currency} = ${rate} INR (${src}, ${when})`;
}
