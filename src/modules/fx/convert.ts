/**
 * Server-side rate table + conversion helpers (the one place the app reads FX for DISPLAY).
 * `getRateTable()` reads the latest INR->X row per currency from `fx_rates` (admin overrides win),
 * caches it for 5 minutes, and lazily refreshes from the provider when the newest fetch is older
 * than 6 hours (single-flight; Hobby cron is daily only). Missing currencies fall back to the
 * static table and mark the table stale. Never throws.
 */
import { desc, eq } from "drizzle-orm";
import {
  convertWithTable,
  hasAllRates,
  isUsableInrRate,
  type RateTable,
} from "@/lib/currency-convert";
import { STATIC_FX_TABLE } from "@/lib/fx";
import { type Currency } from "@/lib/money";
import { fxRates } from "../../../drizzle/schema/settings";
import { FX_QUOTE_CURRENCIES } from "./client";

export const RATE_CACHE_TTL_MS = 5 * 60_000;
export const RATE_FRESH_MS = 6 * 3_600_000;
/** After a failed lazy refresh, don't hammer the providers again for this long. */
export const REFRESH_RETRY_MS = 10 * 60_000;

export function staticRateTable(now: Date = new Date()): RateTable {
  const rates = { INR: "1" } as Record<Currency, string>;
  for (const c of FX_QUOTE_CURRENCIES) rates[c] = STATIC_FX_TABLE[`INR/${c}`] ?? "0"; // never "1": a missing rate must not pass as 1:1
  return { base: "INR", rates, fetchedAt: now.toISOString(), stale: true, source: "static" };
}

export interface RateRowLike {
  base: string;
  quote: string;
  rate: string;
  asOf: string;
  source: string;
  createdAt: Date;
}

/** Pure: build a table from fx_rates rows (any order). Falls back to static per missing currency. */
export function buildRateTable(rows: readonly RateRowLike[], now: Date = new Date()): RateTable {
  const latest = new Map<string, RateRowLike>();
  const sorted = rows
    .filter((r) => r.base === "INR" && isUsableInrRate(r.quote, r.rate))
    .sort((a, b) => b.asOf.localeCompare(a.asOf) || b.createdAt.getTime() - a.createdAt.getTime());
  for (const r of sorted) if (!latest.has(r.quote)) latest.set(r.quote, r);

  const fallback = staticRateTable(now);
  const rates = { ...fallback.rates };
  const times: number[] = [];
  const sources = new Set<string>();
  let missing = false;
  for (const c of FX_QUOTE_CURRENCIES) {
    const row = latest.get(c);
    if (!row) {
      missing = true;
      sources.add("static");
      continue;
    }
    rates[c] = row.rate;
    times.push(row.createdAt.getTime());
    sources.add(row.source);
  }
  if (times.length === 0) return fallback;
  const fetchedAt = new Date(Math.min(...times));
  const stale = missing || now.getTime() - fetchedAt.getTime() > RATE_FRESH_MS;
  return {
    base: "INR",
    rates,
    fetchedAt: fetchedAt.toISOString(),
    stale,
    source: [...sources].join("+"),
  };
}

let cache: { table: RateTable; at: number } | null = null;
let inflight: Promise<RateTable> | null = null;
let lastRefreshFailAt = 0;

/** Test hook. */
export function resetRateTableCache(): void {
  cache = null;
  inflight = null;
  lastRefreshFailAt = 0;
}

async function loadFromDb(now: Date): Promise<RateTable> {
  try {
    const { db } = await import("@/lib/db");
    const rows = await db
      .select()
      .from(fxRates)
      .where(eq(fxRates.base, "INR"))
      .orderBy(desc(fxRates.asOf), desc(fxRates.createdAt));
    return buildRateTable(rows, now);
  } catch {
    return staticRateTable(now);
  }
}

async function refreshNow(): Promise<boolean> {
  try {
    const { fxRefreshJob } = await import("@/jobs/fx");
    const result = await fxRefreshJob.run();
    if (result.written > 0) return true;
  } catch {
    // fall through
  }
  lastRefreshFailAt = Date.now();
  return false;
}

async function load(): Promise<RateTable> {
  let table = await loadFromDb(new Date());
  const age = Date.now() - new Date(table.fetchedAt).getTime();
  const noData = table.source === "static";
  const needsRefresh = noData || table.stale || age > RATE_FRESH_MS;
  if (needsRefresh && Date.now() - lastRefreshFailAt > REFRESH_RETRY_MS) {
    if (noData) {
      // nothing real to show yet: wait for the first fetch
      if (await refreshNow()) table = await loadFromDb(new Date());
    } else {
      // stale-while-revalidate: show the last real rates now, refresh in the background
      lastRefreshFailAt = Date.now() - REFRESH_RETRY_MS + 60_000; // do not stack refreshes
      void refreshNow();
    }
  }
  return hasAllRates(table) ? table : staticRateTable();
}

/** Cached (<= 5 min) rate table; refreshes lazily when older than 6h. Single-flight. */
export function getRateTable(): Promise<RateTable> {
  if (cache && Date.now() - cache.at < RATE_CACHE_TTL_MS) return Promise.resolve(cache.table);
  inflight ??= load()
    .then((table) => {
      cache = { table, at: Date.now() };
      return table;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function convertAmount(
  amountMinor: number,
  from: Currency,
  to: Currency,
): Promise<number> {
  if (from === to) return amountMinor;
  return convertWithTable(amountMinor, from, to, await getRateTable());
}

export async function displayMoney(
  amountMinor: number,
  from: Currency,
  viewerCurrency: Currency,
): Promise<{ amountMinor: number; currency: Currency; approx: boolean }> {
  if (from === viewerCurrency) return { amountMinor, currency: from, approx: false };
  return {
    amountMinor: await convertAmount(amountMinor, from, viewerCurrency),
    currency: viewerCurrency,
    approx: true,
  };
}

export interface FxPanelRow {
  quote: Currency;
  /** Units of `quote` per 1 INR. */
  rate: string;
  asOf: string;
  source: string;
  fetchedAt: string;
  stale: boolean;
}

/** Admin Settings table: latest INR->X row per currency (triggers the lazy refresh first). */
export async function getFxPanelRows(): Promise<FxPanelRow[]> {
  const table = await getRateTable();
  const now = Date.now();
  const rows: RateRowLike[] = [];
  try {
    const { db } = await import("@/lib/db");
    rows.push(
      ...(await db
        .select()
        .from(fxRates)
        .where(eq(fxRates.base, "INR"))
        .orderBy(desc(fxRates.asOf), desc(fxRates.createdAt))),
    );
  } catch {
    // fall through to static rows
  }
  const seen = new Set<string>();
  const out: FxPanelRow[] = [];
  for (const c of FX_QUOTE_CURRENCIES) {
    const r = rows.find((x) => x.quote === c && !seen.has(c));
    if (r) {
      seen.add(c);
      out.push({
        quote: c,
        rate: r.rate,
        asOf: r.asOf,
        source: r.source,
        fetchedAt: r.createdAt.toISOString(),
        stale: now - r.createdAt.getTime() > RATE_FRESH_MS,
      });
    } else {
      out.push({
        quote: c,
        rate: table.rates[c],
        asOf: table.fetchedAt.slice(0, 10),
        source: "static",
        fetchedAt: table.fetchedAt,
        stale: true,
      });
    }
  }
  return out;
}
