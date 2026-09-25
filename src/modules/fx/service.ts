/**
 * FX Service implementation — docs/06 API-FIN-12, docs/04 §4, §10, D-502, D-515, PHASE-03 P3.12.
 * Backed by fx_rates table; supports open.er-api.com rates, manual admin overrides,
 * cross-rates through INR, display price conversions (approx: true), and rateToInrOn for P4 ledger.
 */
import { and, desc, eq, lte } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import { assertPermission } from "@/lib/authz/assert";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { convertMinor, type Currency, type Money } from "@/lib/money";
import { AppError, ErrorCode } from "@/lib/errors";
import { FX_SOURCE_STATIC, STATIC_FX_TABLE, type FxQuote } from "@/lib/fx";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import { fxRates } from "../../../drizzle/schema/settings";
import type {
  FxService,
  SetFxOverrideInput,
  getFxRateSchema,
  refreshFxRatesSchema,
} from "./contracts";
import type { FxRateView, FxRefreshResult, FxSource } from "./types";
import { computeCrossRate, invertRate, isRateStale } from "./client";
import { z } from "zod";

export class DefaultFxService implements FxService {
  private async getDatabase(tx?: DbOrTx) {
    if (tx) return tx;
    if (typeof window !== "undefined") {
      return null;
    }
    const { db } = await import("@/lib/db");
    return db;
  }

  private async getAuditService() {
    const { auditService } = await import("@/modules/audit/service");
    return auditService;
  }

  async refreshFxRates(
    ctx: RequestContext,
    input: z.infer<typeof refreshFxRatesSchema>,
    tx?: DbOrTx,
  ): Promise<{ rates: FxRateView[]; result: FxRefreshResult }> {
    assertPermission(ctx, "settings.write");

    const { fxRefreshJob } = await import("@/jobs/fx");
    const result = await fxRefreshJob.run(input.asOf ? { asOf: input.asOf } : undefined);

    const client = await this.getDatabase(tx);
    if (!client) {
      throw new AppError(ErrorCode.INTERNAL, "Database unavailable");
    }

    const audit = await this.getAuditService();
    await audit.log(
      ctx,
      "API-FIN-12 fx.refresh",
      { type: "fx_rate", id: input.asOf ?? "today" },
      null,
      result,
      client as unknown as TxCtx,
    );

    const { rates } = await this.listRates(ctx, tx);
    return { rates, result };
  }

  async setFxOverride(
    ctx: RequestContext,
    input: SetFxOverrideInput,
    tx?: DbOrTx,
  ): Promise<{ rates: FxRateView[] }> {
    assertPermission(ctx, "settings.write");

    const client = await this.getDatabase(tx);
    if (!client) {
      throw new AppError(ErrorCode.INTERNAL, "Database unavailable");
    }

    const now = new Date();
    const inverseRate = invertRate(input.rate);

    // 1. Upsert INR -> quote
    await client
      .insert(fxRates)
      .values({
        base: "INR",
        quote: input.quote,
        rate: input.rate,
        asOf: input.asOf,
        source: "manual",
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [fxRates.base, fxRates.quote, fxRates.asOf],
        set: {
          rate: input.rate,
          source: "manual",
          createdAt: now,
        },
      });

    // 2. Upsert quote -> INR
    await client
      .insert(fxRates)
      .values({
        base: input.quote,
        quote: "INR",
        rate: inverseRate,
        asOf: input.asOf,
        source: "manual",
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [fxRates.base, fxRates.quote, fxRates.asOf],
        set: {
          rate: inverseRate,
          source: "manual",
          createdAt: now,
        },
      });

    // 3. Audit log
    const audit = await this.getAuditService();
    await audit.log(
      ctx,
      "API-FIN-12 fx.override",
      { type: "fx_rate", id: `${input.asOf}#${input.quote}` },
      null,
      { quote: input.quote, rate: input.rate, asOf: input.asOf },
      client as unknown as TxCtx,
    );

    const { rates } = await this.listRates(ctx, tx);
    return { rates };
  }

  async listRates(
    ctx: RequestContext,
    tx?: DbOrTx,
  ): Promise<{ rates: FxRateView[]; lastSuccessAt: string | null; stale: boolean }> {
    assertPermission(ctx, "settings.read");

    const client = await this.getDatabase(tx);
    if (!client) {
      return { rates: [], lastSuccessAt: null, stale: true };
    }

    const rows = await client
      .select()
      .from(fxRates)
      .orderBy(desc(fxRates.asOf), desc(fxRates.createdAt));

    if (rows.length === 0) {
      return { rates: [], lastSuccessAt: null, stale: true };
    }

    const lastSuccess = rows.find((r) => r.source !== "manual");
    const newestRow = rows[0];
    const stale = !newestRow || isRateStale(newestRow.asOf);

    const rates: FxRateView[] = rows.map((r) => ({
      base: r.base as Currency,
      quote: r.quote as Currency,
      rate: r.rate,
      asOf: r.asOf,
      source: r.source as FxSource,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      rates,
      lastSuccessAt: lastSuccess?.createdAt.toISOString() ?? null,
      stale,
    };
  }

  async getRate(input: z.infer<typeof getFxRateSchema>, tx?: DbOrTx): Promise<FxQuote> {
    const day = input.asOf ?? new Date().toISOString().slice(0, 10);

    if (input.base === input.quote) {
      return { rate: "1.00000000", asOf: day, source: FX_SOURCE_STATIC };
    }

    const client = await this.getDatabase(tx);

    if (client) {
      // Direct match from fx_rates
      const [directRow] = await client
        .select()
        .from(fxRates)
        .where(
          and(eq(fxRates.base, input.base), eq(fxRates.quote, input.quote), lte(fxRates.asOf, day)),
        )
        .orderBy(desc(fxRates.asOf), desc(fxRates.createdAt))
        .limit(1);

      if (directRow) {
        return {
          rate: directRow.rate,
          asOf: directRow.asOf,
          source: directRow.source,
        };
      }

      // Cross-rate via INR if neither is INR
      if (input.base !== "INR" && input.quote !== "INR") {
        const [baseToInr] = await client
          .select()
          .from(fxRates)
          .where(
            and(eq(fxRates.base, input.base), eq(fxRates.quote, "INR"), lte(fxRates.asOf, day)),
          )
          .orderBy(desc(fxRates.asOf), desc(fxRates.createdAt))
          .limit(1);

        const [inrToQuote] = await client
          .select()
          .from(fxRates)
          .where(
            and(eq(fxRates.base, "INR"), eq(fxRates.quote, input.quote), lte(fxRates.asOf, day)),
          )
          .orderBy(desc(fxRates.asOf), desc(fxRates.createdAt))
          .limit(1);

        if (baseToInr && inrToQuote) {
          const crossRate = computeCrossRate(baseToInr.rate, inrToQuote.rate);
          return {
            rate: crossRate,
            asOf: baseToInr.asOf,
            source:
              baseToInr.source === "manual" || inrToQuote.source === "manual"
                ? "manual"
                : baseToInr.source,
          };
        }
      }
    }

    // Fall back to static table
    const staticRate = STATIC_FX_TABLE[`${input.base}/${input.quote}`];
    if (staticRate !== undefined) {
      return {
        rate: staticRate,
        asOf: day,
        source: FX_SOURCE_STATIC,
      };
    }

    throw new AppError(
      ErrorCode.UPSTREAM_UNAVAILABLE,
      `No FX rate for ${input.base}/${input.quote}`,
    );
  }

  async convertDisplay(
    money: Money,
    to: Currency,
    asOf?: Date,
    tx?: DbOrTx,
  ): Promise<{ money: Money; approx: boolean; rate: string }> {
    if (money.currency === to) {
      return { money, approx: false, rate: "1.00000000" };
    }

    const day = asOf ? asOf.toISOString().slice(0, 10) : undefined;
    const quote = await this.getRate({ base: money.currency, quote: to, asOf: day }, tx);

    const convertedAmount = convertMinor(money.amountMinor, quote.rate);
    return {
      money: { amountMinor: convertedAmount, currency: to },
      approx: true,
      rate: quote.rate,
    };
  }

  async rateToInrOn(currency: Currency, date: string | Date, tx?: DbOrTx): Promise<string> {
    if (currency === "INR") {
      return "1.00000000";
    }

    const day = typeof date === "string" ? date : date.toISOString().slice(0, 10);
    const quote = await this.getRate({ base: currency, quote: "INR", asOf: day }, tx);
    return quote.rate;
  }
}

export const fxService: FxService = new DefaultFxService();

/** Every member throws / rejects `AppError(INTERNAL, "fx.<method> not implemented (P3)")`. */
export function createNotImplementedFxService(): FxService {
  return createNotImplemented<FxService>("fx", "P3", {
    refreshFxRates: "async",
    setFxOverride: "async",
    listRates: "async",
    getRate: "async",
    convertDisplay: "async",
    rateToInrOn: "async",
  });
}
