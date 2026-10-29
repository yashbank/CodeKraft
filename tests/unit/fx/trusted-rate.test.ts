import { describe, expect, it, vi } from "vitest";
import type { DbOrTx } from "@/lib/db";
import { STATIC_FX_TABLE } from "@/lib/fx";
import { invertRate } from "@/modules/fx/client";
import { resolveExpenseRate } from "@/modules/fx/expense-rate";
import { toInrMinor } from "@/modules/finance/minor";
import { convertMinor } from "@/lib/money";

const NOW = new Date("2026-10-29T10:12:00Z");
/** Provider quotes INR -> USD; 1 USD = 83.25 INR  =>  0.01201201 (8dp). */
const INR_PER_USD = "83.25000000";
const USD_PER_INR = invertRate(INR_PER_USD);

const dbWith = (row: unknown): DbOrTx => {
  const chain: Record<string, unknown> = {};
  for (const k of ["select", "from", "where", "orderBy"]) chain[k] = () => chain;
  chain.limit = () => Promise.resolve(row ? [row] : []);
  chain.insert = () => chain;
  chain.values = () => chain;
  chain.onConflictDoNothing = () => Promise.resolve();
  return chain as unknown as DbOrTx;
};
const provider = (usdPerInr: string) =>
  vi.fn(async () =>
    Response.json({ result: "success", base_code: "INR", rates: { USD: Number(usdPerInr) } }),
  ) as unknown as typeof fetch;
const down = vi.fn(async () => {
  throw new Error("provider down");
}) as unknown as typeof fetch;

describe("trusted FX rate (R9-09)", () => {
  it("1 USD = 83.25 INR: $10 -> INR 832.50 and back", async () => {
    const lock = await resolveExpenseRate({
      currency: "USD",
      db: dbWith(null),
      now: NOW,
      fetchFn: provider(USD_PER_INR),
    });
    expect(Number(lock.rate)).toBeCloseTo(83.25, 4);
    expect(toInrMinor(1000, lock.rate)).toBe(83250); // 2dp minor units
    expect(convertMinor(83250, USD_PER_INR)).toBe(1000); // reverse direction
  });

  it("rounds to whole minor units (half up)", () => {
    expect(toInrMinor(1, "83.25000000")).toBe(83); // 83.25 paise -> 83
    expect(toInrMinor(2, "83.25000000")).toBe(167); // 166.5 -> 167
  });

  it("falls back to the configured default (never throws, never 1:1) when provider and DB fail", async () => {
    const lock = await resolveExpenseRate({
      currency: "USD",
      db: dbWith(null),
      now: NOW,
      fetchFn: down,
    });
    expect(lock).toMatchObject({ source: "default", rate: STATIC_FX_TABLE["USD/INR"] });
    expect(lock.rate).not.toBe("1.00000000");
  });

  it("default table is direction-consistent (X/INR is the inverse of INR/X)", () => {
    for (const c of ["USD", "EUR", "GBP", "CAD"]) {
      const back = Number(STATIC_FX_TABLE[`${c}/INR`]);
      const fwd = Number(STATIC_FX_TABLE[`INR/${c}`]);
      expect(Math.abs(back * fwd - 1)).toBeLessThan(1e-6);
    }
  });

  it("a rate locked on the expense does not change when the market rate updates", async () => {
    const locked = await resolveExpenseRate({
      currency: "USD",
      db: dbWith(null),
      now: NOW,
      fetchFn: provider(USD_PER_INR),
    });
    const later = await resolveExpenseRate({
      currency: "USD",
      db: dbWith(null),
      now: NOW,
      fetchFn: provider(invertRate("90.00000000")),
      locked,
    });
    expect(later).toBe(locked);
    expect(toInrMinor(1000, later.rate)).toBe(toInrMinor(1000, locked.rate));
  });

  it("an admin override for today beats the live provider", async () => {
    const row = {
      rate: "84.00000000",
      source: "manual",
      asOf: "2026-10-29",
      createdAt: NOW,
    };
    const fetchFn = provider(USD_PER_INR);
    const lock = await resolveExpenseRate({ currency: "USD", db: dbWith(row), now: NOW, fetchFn });
    expect(lock).toMatchObject({ rate: "84.00000000", source: "stored:manual" });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
