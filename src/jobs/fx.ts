/**
 * Daily FX refresh job — docs/06 §3.3, docs/04 §4, §10, TM-13, PHASE-03 P3.12.
 * Fetches base INR rates from open.er-api.com for USD, EUR, GBP, CAD.
 * Enforces ±20% sanity bounds vs previous rates (TM-13); rejects poisoned rates.
 * Upserts rates for both directions into fx_rates table.
 * Detects staleness (> 3 days) and notifies admins with N: system.fx_stale once per day.
 * Records execution into job_runs.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { fxRates } from "../../drizzle/schema/settings";
import { jobRuns } from "../../drizzle/schema/ops";
import { userRoles } from "../../drizzle/schema/auth";
import { notifications } from "../../drizzle/schema/notifications";
import type { Currency } from "@/lib/money";
import { fetchOpenErRates, invertRate, isRateStale, isWithinBounds } from "@/modules/fx/client";
import { FX_REFRESH_JOB_KEY, type FxRefreshResult } from "@/modules/fx/types";

async function getDb() {
  const { db } = await import("@/lib/db");
  return db;
}

export interface FxRefreshRunOptions {
  asOf?: string;
  currencies?: readonly Currency[];
  mockRates?: Record<string, string>;
  customUrl?: string;
  fetchFn?: typeof fetch;
}

export const fxRefreshJob = {
  key: FX_REFRESH_JOB_KEY,

  async run(
    inputOrNow?: Date | { asOf?: string; currencies?: readonly Currency[] },
    runOptions?: FxRefreshRunOptions,
  ): Promise<FxRefreshResult> {
    const startedAt = new Date();
    const now = inputOrNow instanceof Date ? inputOrNow : new Date();
    const db = await getDb();

    let asOf =
      !(inputOrNow instanceof Date) && inputOrNow?.asOf
        ? inputOrNow.asOf
        : runOptions?.asOf || now.toISOString().slice(0, 10);

    const currencies: readonly Currency[] =
      !(inputOrNow instanceof Date) && inputOrNow?.currencies
        ? inputOrNow.currencies
        : runOptions?.currencies || ["USD", "EUR", "GBP", "CAD"];

    let status: "ok" | "error" = "ok";
    let written = 0;
    const errors: string[] = [];
    const poisonedQuotes: string[] = [];

    try {
      // 1. Fetch latest previous rates for base INR to perform TM-13 sanity bounds check
      const prevRows = await db
        .select()
        .from(fxRates)
        .where(and(eq(fxRates.base, "INR"), inArray(fxRates.quote, currencies as string[])))
        .orderBy(desc(fxRates.asOf));

      const prevRateMap = new Map<string, string>();
      for (const row of prevRows) {
        if (!prevRateMap.has(row.quote)) {
          prevRateMap.set(row.quote, row.rate);
        }
      }

      // 2. Fetch new rates from provider or mock
      let fetchedRates: Record<string, string> = {};
      if (runOptions?.mockRates) {
        fetchedRates = runOptions.mockRates;
      } else {
        try {
          const fetchResult = await fetchOpenErRates(runOptions?.customUrl, runOptions?.fetchFn);
          fetchedRates = fetchResult.rates;
          if (fetchResult.asOf) {
            asOf = fetchResult.asOf;
          }
        } catch (fetchErr) {
          const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          errors.push(msg);
          status = "error";
        }
      }

      // 3. Process each currency with TM-13 bounds check and write to fx_rates
      for (const quote of currencies) {
        const newRate = fetchedRates[quote];
        if (!newRate) continue;

        const prevRate = prevRateMap.get(quote);
        if (prevRate) {
          const withinBounds = isWithinBounds(prevRate, newRate);
          if (!withinBounds) {
            poisonedQuotes.push(quote);
            errors.push(
              `Rate for INR/${quote} (${newRate}) exceeds ±20% sanity bound vs previous (${prevRate})`,
            );
            status = "error";
            continue; // Reject poisoned rate
          }
        }

        // Check if a manual override exists for today
        const [existingOverride] = await db
          .select()
          .from(fxRates)
          .where(
            and(
              eq(fxRates.base, "INR"),
              eq(fxRates.quote, quote),
              eq(fxRates.asOf, asOf),
              eq(fxRates.source, "manual"),
            ),
          )
          .limit(1);

        if (existingOverride) {
          // Manual override takes precedence for its date
          continue;
        }

        const inverseRate = invertRate(newRate);

        // Upsert INR -> quote
        await db
          .insert(fxRates)
          .values({
            base: "INR",
            quote,
            rate: newRate,
            asOf,
            source: "open.er-api.com",
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: [fxRates.base, fxRates.quote, fxRates.asOf],
            set: {
              rate: newRate,
              source: "open.er-api.com",
              createdAt: now,
            },
          });
        written += 1;

        // Upsert quote -> INR
        await db
          .insert(fxRates)
          .values({
            base: quote,
            quote: "INR",
            rate: inverseRate,
            asOf,
            source: "open.er-api.com",
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: [fxRates.base, fxRates.quote, fxRates.asOf],
            set: {
              rate: inverseRate,
              source: "open.er-api.com",
              createdAt: now,
            },
          });
        written += 1;
      }

      // 4. Staleness check: check newest rate in fx_rates
      const [newestRow] = await db
        .select({ asOf: fxRates.asOf })
        .from(fxRates)
        .where(eq(fxRates.base, "INR"))
        .orderBy(desc(fxRates.asOf))
        .limit(1);

      let stale = false;
      if (!newestRow || isRateStale(newestRow.asOf, now)) {
        stale = true;
      }

      // 5. If stale or poisoned, notify admins with N: system.fx_stale once per day
      if (stale || poisonedQuotes.length > 0) {
        await notifyAdminsIfStale(now, stale, poisonedQuotes);
      }

      const result: FxRefreshResult = {
        asOf,
        source: "open.er-api.com",
        written,
        error: errors.length > 0 ? errors.join("; ") : undefined,
        stale,
      };

      await recordJobRun(startedAt, status, {
        asOf,
        written,
        stale,
        poisonedQuotes,
        errors,
      });

      return result;
    } catch (err: unknown) {
      status = "error";
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);

      await recordJobRun(startedAt, status, {
        asOf,
        written,
        error: errMsg,
      });

      return {
        asOf,
        source: "open.er-api.com",
        written,
        error: errMsg,
        stale: true,
      };
    }
  },
};

async function recordJobRun(
  startedAt: Date,
  status: "ok" | "error",
  detail: Record<string, unknown>,
) {
  try {
    const db = await getDb();
    await db.insert(jobRuns).values({
      job: FX_REFRESH_JOB_KEY,
      startedAt,
      finishedAt: new Date(),
      status,
      detail,
    });
  } catch {
    // Ignore logging failures
  }
}

async function notifyAdminsIfStale(now: Date, stale: boolean, poisonedQuotes: string[]) {
  try {
    const db = await getDb();
    const today = now.toISOString().slice(0, 10);

    // Check if notification was already sent today
    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.type, "system.fx_stale"),
          sql`DATE(${notifications.createdAt}) = ${today}::date`,
        ),
      )
      .limit(1);

    if (existing) return; // Deduplicated: only once per day

    // Find all active admins
    const admins = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(inArray(userRoles.roleKey, ["admin", "super_admin"]));

    const reason =
      poisonedQuotes.length > 0
        ? `Poisoned rate detected for ${poisonedQuotes.join(", ")} outside ±20% bounds.`
        : "FX rates have not been updated for over 3 days.";

    for (const a of admins) {
      await db.insert(notifications).values({
        userId: a.userId,
        type: "system.fx_stale",
        title: "FX Rates Warning",
        body: reason,
        channelState: { inapp: "sent" },
        createdAt: now,
      });
    }
  } catch {
    // Non-fatal
  }
}
