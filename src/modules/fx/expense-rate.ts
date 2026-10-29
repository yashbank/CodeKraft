/**
 * The one trusted X -> INR rate source (P9-02, R9-09). Chain: locked (unless refresh) -> manual ->
 * today's admin override in fx_rates -> live (timeout; written through to fx_rates so display and
 * ledger read the same number) -> stored row (< 7 days, flagged) -> configured default
 * (STATIC_FX_TABLE, flagged). Never silently 1:1. Direction: 1 unit of the currency = `rate` INR.
 */
import { and, desc, eq } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { STATIC_FX_TABLE } from "@/lib/fx";
import type { Currency } from "@/lib/money";
import { fxRates } from "../../../drizzle/schema/settings";
import { fetchOpenErRates, invertRate, to8DecimalString } from "./client";

export const EXPENSE_FX_TIMEOUT_MS = 5000;
export const EXPENSE_FX_STORED_MAX_AGE_DAYS = 7;
export const STORED_PREFIX = "stored:";

export interface LockedRate {
  /** 1 unit of the expense currency = `rate` INR (8 decimals). */
  rate: string;
  /** `open.er-api.com` | `stored:<src>` | `manual` | `default` | `base`. */
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

type StoredRow = { rate: string; source: string; createdAt: Date };
const fromRow = (row: StoredRow): LockedRate => ({
  rate: row.rate,
  source: `${STORED_PREFIX}${row.source}`,
  at: row.createdAt.toISOString(),
});

export async function resolveExpenseRate(o: ResolveExpenseRateOptions): Promise<LockedRate> {
  const now = o.now ?? new Date();
  if (o.currency === "INR") return { rate: "1.00000000", source: "base", at: now.toISOString() };
  if (o.locked && !o.refresh) return o.locked;
  if (o.manualRate) {
    return { rate: to8DecimalString(o.manualRate), source: "manual", at: now.toISOString() };
  }

  const [row] = await o.db
    .select()
    .from(fxRates)
    .where(and(eq(fxRates.base, o.currency), eq(fxRates.quote, "INR")))
    .orderBy(desc(fxRates.asOf), desc(fxRates.createdAt))
    .limit(1);
  const today = now.toISOString().slice(0, 10);
  if (row?.source === "manual" && row.asOf >= today) return fromRow(row);

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
      const rate = invertRate(inrToX);
      await persistLive(o.db, o.currency, inrToX, rate, today, now, host);
      return { rate, source: host, at: now.toISOString() };
    }
  } catch {
    // fall through to the stored rate
  }

  if (row && now.getTime() - row.createdAt.getTime() < EXPENSE_FX_STORED_MAX_AGE_DAYS * 864e5) {
    return fromRow(row);
  }

  const dflt = STATIC_FX_TABLE[`${o.currency}/INR`];
  if (dflt) return { rate: dflt, source: "default", at: now.toISOString() };
  throw new AppError(
    ErrorCode.VALIDATION,
    `No ${o.currency}/INR rate is available. Enter the rate manually.`,
    { fieldErrors: { manualRate: [`Enter the rate: 1 ${o.currency} = ? INR`] } },
  );
}

/** Best-effort write-through of a live quote (both directions) so storefront/ledger read it too. */
async function persistLive(
  db: DbOrTx,
  currency: Currency,
  inrToX: string,
  xToInr: string,
  asOf: string,
  now: Date,
  source: string,
) {
  try {
    await db
      .insert(fxRates)
      .values([
        { base: "INR", quote: currency, rate: inrToX, asOf, source, createdAt: now },
        { base: currency, quote: "INR", rate: xToInr, asOf, source, createdAt: now },
      ])
      .onConflictDoNothing();
  } catch {
    // read-only / mocked db: the lock itself still succeeds
  }
}

/** "1 USD = 83.12 INR (open.er-api.com, 29 Oct 2026 10:12 UTC)"; stored/default rates are flagged. */
export function formatRateLine(currency: string, l: LockedRate): string {
  const [w = "0", f = ""] = l.rate.split(".");
  const rate = `${w}.${f.replace(/0+$/, "").padEnd(2, "0")}`;
  const d = new Date(l.at);
  const when =
    `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()} ` +
    `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
  const src = l.source.startsWith(STORED_PREFIX)
    ? `stored rate, ${l.source.slice(STORED_PREFIX.length)}`
    : l.source === "default"
      ? "default rate, may be out of date"
      : l.source;
  return `1 ${currency} = ${rate} INR (${src}, ${when})`;
}
