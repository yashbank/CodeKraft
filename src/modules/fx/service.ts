/**
 * `fx` service (PHASE-03 P3.12; docs/06 API-FIN-12, §3.3 `fx.refresh`; docs/04 §7.8; D-502, D-515,
 * TM-13). Rates live in `fx_rates(base, quote, as_of)`; conversions go through `lib/money`.
 *
 * - `getRate`: latest row at or before `asOf` (falls back to the last cached row, then to the
 *   static table); `stale` when the row is older than 3 days.
 * - `refresh` (the `FxRefreshJob`): fetch base INR, sanity-bound ±20 % vs the previous rate,
 *   upsert both directions (a `manual` override for the same day wins), keep old rates and
 *   notify `system.fx_stale` on failure.
 * - `convertDisplay` / `rateToInrOn`: display prices (`approx: true`) and ledger FX snapshots.
 */
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { type DbOrTx, type TxCtx, getDb } from "@/lib/db";
import { isoDate } from "@/lib/dates";
import { getEnv } from "@/lib/env";
import { AppError, ErrorCode } from "@/lib/errors";
import { type FxProvider, type FxQuote, STATIC_FX_TABLE } from "@/lib/fx";
import { moduleLogger } from "@/lib/logger";
import { type Currency, type Money, convertMinor } from "@/lib/money";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import { fxRates } from "../../../drizzle/schema/settings";
import type { AuditService } from "../audit/contracts";
import { auditService } from "../audit/service";
import { runInTx } from "../audit/tx";
import type { NotificationsService } from "../notifications/contracts";
import * as notificationsModule from "../notifications/service";
import type { SettingsService } from "../settings/contracts";
import { settingsService } from "../settings/service";
import {
  type FetchLike,
  fetchProviderRates,
  invertRate,
  isStale,
  withinBounds,
} from "./client";
import type { FxRefreshJob, FxService, SetFxOverrideInput, getFxRateSchema, refreshFxRatesSchema } from "./contracts";
import {
  FX_FETCH_BASE,
  FX_REFRESH_JOB_KEY,
  type FxRateView,
  type FxRefreshResult,
  type FxSource,
} from "./types";
import type { z } from "zod";

export const FX_PROVIDER_SOURCE: FxSource = "open.er-api.com";
export const FX_MANUAL_SOURCE: FxSource = "manual";

export interface FxDeps {
  db: () => DbOrTx;
  audit: AuditService;
  notifications: Pick<NotificationsService, "emit">;
  settings: Pick<SettingsService, "load">;
  fetch?: FetchLike;
  apiUrl?: () => string;
  now?: () => Date;
}

export interface FxQuoteWithStale extends FxQuote {
  /** Rate older than 3 days (or static fallback). */
  stale: boolean;
}

export interface ConvertDisplayResult {
  money: Money;
  /** `true` whenever a conversion happened (display prices are indicative, D-502). */
  approx: boolean;
  rate: string;
  asOf: string;
  source: string;
}

export interface FxServiceImpl extends FxService, FxRefreshJob {
  readonly key: typeof FX_REFRESH_JOB_KEY;
  run: FxRefreshJob["run"];
  getRate(input: z.infer<typeof getFxRateSchema>, tx?: DbOrTx): Promise<FxQuoteWithStale>;
  /** Indicative conversion for display prices; never used for ledger amounts. */
  convertDisplay(money: Money, to: Currency, tx?: DbOrTx): Promise<ConvertDisplayResult>;
  /** `fxRateToInr` for a ledger entry / order on `date` (D-515). */
  rateToInrOn(currency: Currency, date: string, tx?: DbOrTx): Promise<string>;
  /** `FxProvider` adapter for `src/lib/fx.setFxProvider`. */
  asProvider(): FxProvider;
}

type FxRow = typeof fxRates.$inferSelect;

function toView(r: FxRow): FxRateView {
  return {
    base: r.base as Currency,
    quote: r.quote as Currency,
    rate: r.rate,
    asOf: r.asOf,
    source: r.source as FxSource,
    createdAt: r.createdAt.toISOString(),
  };
}

const log = moduleLogger("fx");

export function createFxService(deps: FxDeps): FxServiceImpl {
  const now = deps.now ?? (() => new Date());
  const fetchFn: FetchLike = deps.fetch ?? ((input, init) => fetch(input, init));
  const apiUrl = deps.apiUrl ?? (() => getEnv().FX_API_URL);

  async function latestRow(
    db: DbOrTx,
    base: Currency,
    quote: Currency,
    asOf?: string,
  ): Promise<FxRow | undefined> {
    const where =
      asOf === undefined
        ? and(eq(fxRates.base, base), eq(fxRates.quote, quote))
        : and(eq(fxRates.base, base), eq(fxRates.quote, quote), lte(fxRates.asOf, asOf));
    const [row] = await db.select().from(fxRates).where(where).orderBy(desc(fxRates.asOf)).limit(1);
    return row;
  }

  async function getRate(
    input: z.infer<typeof getFxRateSchema>,
    tx?: DbOrTx,
  ): Promise<FxQuoteWithStale> {
    const db = tx ?? deps.db();
    const asOf = input.asOf ?? isoDate(now());
    if (input.base === input.quote) {
      return { rate: "1.00000000", asOf, source: "identity", stale: false };
    }
    const row = (await latestRow(db, input.base, input.quote, asOf)) ?? (await latestRow(db, input.base, input.quote));
    if (row !== undefined) {
      return {
        rate: row.rate,
        asOf: row.asOf,
        source: row.source,
        stale: isStale(row.asOf, new Date(`${asOf}T00:00:00.000Z`)),
      };
    }
    const fallback = STATIC_FX_TABLE[`${input.base}/${input.quote}`];
    if (fallback === undefined) {
      throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, `No FX rate for ${input.base}/${input.quote}`);
    }
    return { rate: fallback, asOf, source: "static", stale: true };
  }

  async function lastSuccessAsOf(db: DbOrTx): Promise<string | null> {
    const [row] = await db
      .select({ asOf: fxRates.asOf })
      .from(fxRates)
      .where(eq(fxRates.source, FX_PROVIDER_SOURCE))
      .orderBy(desc(fxRates.asOf))
      .limit(1);
    return row?.asOf ?? null;
  }

  async function notifyStale(tx: TxCtx, asOf: string, reason: string): Promise<void> {
    try {
      await deps.notifications.emit(
        "admins",
        "system.fx_stale",
        { asOf, reason },
        undefined,
        tx,
        { onceKey: `fx_stale:${asOf}` },
      );
    } catch (err) {
      log.warn({ err }, "fx stale notification failed");
    }
  }

  async function upsertPair(
    tx: TxCtx,
    base: Currency,
    quote: Currency,
    rate: string,
    asOf: string,
    source: FxSource,
  ): Promise<number> {
    const rows = await tx
      .insert(fxRates)
      .values({ base, quote, rate, asOf, source })
      .onConflictDoUpdate({
        target: [fxRates.base, fxRates.quote, fxRates.asOf],
        set: { rate, source, createdAt: sql`now()` },
        // A manual override for the same day wins over the provider (docs/06 API-FIN-12).
        setWhere:
          source === FX_MANUAL_SOURCE
            ? undefined
            : sql`${fxRates.source} <> ${FX_MANUAL_SOURCE}`,
      })
      .returning({ base: fxRates.base });
    return rows.length;
  }

  async function run(
    input: { asOf: string; currencies: readonly Currency[] },
    tx: TxCtx,
  ): Promise<FxRefreshResult> {
    const quotes = input.currencies.filter((c) => c !== FX_FETCH_BASE);
    const at = new Date(`${input.asOf}T00:00:00.000Z`);
    let fetched;
    try {
      fetched = await fetchProviderRates(fetchFn, apiUrl(), FX_FETCH_BASE, quotes);
    } catch (err) {
      const last = await lastSuccessAsOf(tx);
      const stale = isStale(last, at);
      const message = err instanceof Error ? err.message : String(err);
      log.warn({ err, asOf: input.asOf }, "fx refresh failed; keeping previous rates");
      if (stale) await notifyStale(tx, input.asOf, message);
      return { asOf: input.asOf, source: FX_PROVIDER_SOURCE, written: 0, error: message, stale };
    }
    let written = 0;
    const rejected: string[] = [];
    for (const quote of quotes) {
      const rate = fetched.rates[quote];
      if (rate === undefined) {
        rejected.push(`${quote}: missing`);
        continue;
      }
      const previous = await latestRow(tx, FX_FETCH_BASE, quote);
      if (previous !== undefined && previous.asOf < input.asOf && !withinBounds(rate, previous.rate)) {
        rejected.push(`${quote}: ${rate} deviates > 20% from ${previous.rate} (${previous.asOf})`);
        continue;
      }
      written += await upsertPair(tx, FX_FETCH_BASE, quote, rate, input.asOf, FX_PROVIDER_SOURCE);
      written += await upsertPair(tx, quote, FX_FETCH_BASE, invertRate(rate), input.asOf, FX_PROVIDER_SOURCE);
    }
    const last = await lastSuccessAsOf(tx);
    const stale = isStale(last, at);
    if (rejected.length > 0) {
      log.warn({ rejected, asOf: input.asOf }, "fx rates rejected by sanity bounds");
      await notifyStale(tx, input.asOf, `rejected: ${rejected.join("; ")}`);
    } else if (stale) {
      await notifyStale(tx, input.asOf, "no fresh rate written");
    }
    const result: FxRefreshResult = { asOf: input.asOf, source: FX_PROVIDER_SOURCE, written, stale };
    if (rejected.length > 0) result.error = `rejected: ${rejected.join("; ")}`;
    return result;
  }

  async function listLatest(db: DbOrTx): Promise<FxRateView[]> {
    const rows = await db
      .select()
      .from(fxRates)
      .where(
        sql`(${fxRates.base}, ${fxRates.quote}, ${fxRates.asOf}) in (select base, quote, max(as_of) from fx_rates group by base, quote)`,
      )
      .orderBy(fxRates.base, fxRates.quote);
    return rows.map(toView);
  }

  async function refreshFxRates(
    ctx: RequestContext,
    input: z.infer<typeof refreshFxRatesSchema>,
    tx?: DbOrTx,
  ): Promise<{ rates: FxRateView[]; result: FxRefreshResult }> {
    assertPermission(ctx, "settings.write");
    return runInTx(tx ?? deps.db(), async (t) => {
      const settings = await deps.settings.load(t);
      const asOf = input.asOf ?? isoDate(now());
      const result = await run({ asOf, currencies: settings.enabledCurrencies }, t);
      await deps.audit.log(ctx, "API-FIN-12 fx.refresh", { type: "fx_rates", id: asOf }, null, result, t);
      return { rates: await listLatest(t), result };
    });
  }

  async function setFxOverride(
    ctx: RequestContext,
    input: SetFxOverrideInput,
    tx?: DbOrTx,
  ): Promise<{ rates: FxRateView[] }> {
    assertPermission(ctx, "settings.write");
    return runInTx(tx ?? deps.db(), async (t) => {
      const before = await latestRow(t, FX_FETCH_BASE, input.quote, input.asOf);
      await upsertPair(t, FX_FETCH_BASE, input.quote, input.rate, input.asOf, FX_MANUAL_SOURCE);
      await upsertPair(t, input.quote, FX_FETCH_BASE, invertRate(input.rate), input.asOf, FX_MANUAL_SOURCE);
      await deps.audit.log(
        ctx,
        "API-FIN-12 fx.override",
        { type: "fx_rates", id: `${FX_FETCH_BASE}/${input.quote}/${input.asOf}` },
        before === undefined ? null : { rate: before.rate, asOf: before.asOf, source: before.source },
        { rate: input.rate, asOf: input.asOf, source: FX_MANUAL_SOURCE },
        t,
      );
      return { rates: await listLatest(t) };
    });
  }

  async function listRates(
    ctx: RequestContext,
    tx?: DbOrTx,
  ): Promise<{ rates: FxRateView[]; lastSuccessAt: string | null; stale: boolean }> {
    assertPermission(ctx, "settings.read");
    const db = tx ?? deps.db();
    const last = await lastSuccessAsOf(db);
    return { rates: await listLatest(db), lastSuccessAt: last, stale: isStale(last, now()) };
  }

  async function convertDisplay(money: Money, to: Currency, tx?: DbOrTx): Promise<ConvertDisplayResult> {
    if (money.currency === to) {
      return { money, approx: false, rate: "1.00000000", asOf: isoDate(now()), source: "identity" };
    }
    const q = await getRate({ base: money.currency, quote: to }, tx);
    return {
      money: { amountMinor: convertMinor(money.amountMinor, q.rate), currency: to },
      approx: true,
      rate: q.rate,
      asOf: q.asOf,
      source: q.source,
    };
  }

  async function rateToInrOn(currency: Currency, date: string, tx?: DbOrTx): Promise<string> {
    const q = await getRate({ base: currency, quote: "INR", asOf: date }, tx);
    return q.rate;
  }

  function asProvider(): FxProvider {
    return {
      getRate: async (base, quote, asOf) => {
        const q = await getRate({ base, quote, ...(asOf === undefined ? {} : { asOf: isoDate(asOf) }) });
        return { rate: q.rate, asOf: q.asOf, source: q.source };
      },
    };
  }

  return {
    key: FX_REFRESH_JOB_KEY,
    run,
    refreshFxRates,
    setFxOverride,
    listRates,
    getRate,
    convertDisplay,
    rateToInrOn,
    asProvider,
  };
}

function defaultNotifications(): Pick<NotificationsService, "emit"> {
  const mod = notificationsModule as { notificationsService?: NotificationsService };
  return mod.notificationsService ?? notificationsModule.createNotImplementedNotificationsService();
}

export const fxService: FxServiceImpl = createFxService({
  db: () => getDb(),
  audit: auditService,
  notifications: defaultNotifications(),
  settings: settingsService,
});

/** P2.8 skeleton kept for modules that still fall back to a NotImplemented fx port. */
export function createNotImplementedFxService(): FxService {
  return createNotImplemented<FxService>("fx", "P3", {
    refreshFxRates: "async",
    setFxOverride: "async",
    listRates: "async",
    getRate: "async",
  });
}
