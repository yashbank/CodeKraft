import { describe, expect, it, vi } from "vitest";
import type { DbOrTx } from "@/lib/db";
import { formatRateLine, resolveExpenseRate, toBaseMinor } from "@/modules/fx/expense-rate";

const NOW = new Date("2026-10-29T10:12:00Z");

const dbWith = (row: unknown): DbOrTx => {
  const chain: Record<string, unknown> = {};
  for (const k of ["select", "from", "where", "orderBy"]) chain[k] = () => chain;
  chain.limit = () => Promise.resolve(row ? [row] : []);
  return chain as unknown as DbOrTx;
};

// provider quotes INR -> USD = 0.01203
const liveFetch = vi.fn(async () =>
  Response.json({ result: "success", base_code: "INR", rates: { USD: 0.012 } }),
) as unknown as typeof fetch;
const failFetch = vi.fn(async () => {
  throw new Error("timeout");
}) as unknown as typeof fetch;

describe("resolveExpenseRate", () => {
  it("locks the live rate and the ledger amount matches", async () => {
    const lock = await resolveExpenseRate({
      currency: "USD",
      db: dbWith(null),
      now: NOW,
      fetchFn: liveFetch,
    });
    expect(lock).toMatchObject({ rate: "83.33333333", source: "open.er-api.com" });
    expect(toBaseMinor(1234, lock.rate)).toBe(Math.round(1234 * 83.33333333)); // $12.34 -> paise
    expect(formatRateLine("USD", lock)).toBe(
      "1 USD = 83.33333333 INR (open.er-api.com, 29 Oct 2026 10:12 UTC)",
    );
  });

  it("uses a recent stored rate when the fetch fails and flags it", async () => {
    const row = {
      rate: "83.12000000",
      source: "open.er-api.com",
      createdAt: new Date("2026-10-26T10:12:00Z"),
    };
    const lock = await resolveExpenseRate({
      currency: "USD",
      db: dbWith(row),
      now: NOW,
      fetchFn: failFetch,
    });
    expect(lock.source).toBe("stored:open.er-api.com");
    expect(formatRateLine("USD", lock)).toBe(
      "1 USD = 83.12 INR (stored rate, open.er-api.com, 26 Oct 2026 10:12 UTC)",
    );
  });

  it("requires a manual rate when the stored rate is stale or missing", async () => {
    const stale = { rate: "83.12000000", source: "x", createdAt: new Date("2026-10-01T00:00:00Z") };
    for (const row of [stale, null]) {
      await expect(
        resolveExpenseRate({ currency: "USD", db: dbWith(row), now: NOW, fetchFn: failFetch }),
      ).rejects.toMatchObject({ fieldErrors: { manualRate: expect.any(Array) } });
    }
  });

  it("uses the manual rate without fetching", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const lock = await resolveExpenseRate({
      currency: "EUR",
      db: dbWith(null),
      now: NOW,
      fetchFn,
      manualRate: "90.5",
    });
    expect(lock).toMatchObject({ rate: "90.50000000", source: "manual" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("edit keeps the locked rate unless refresh is requested", async () => {
    const locked = { rate: "80.00000000", source: "manual", at: "2026-10-01T00:00:00.000Z" };
    const kept = await resolveExpenseRate({
      currency: "USD",
      db: dbWith(null),
      locked,
      fetchFn: failFetch,
    });
    expect(kept).toBe(locked);
    const fresh = await resolveExpenseRate({
      currency: "USD",
      db: dbWith(null),
      locked,
      refresh: true,
      now: NOW,
      fetchFn: liveFetch,
    });
    expect(fresh.rate).toBe("83.33333333");
  });

  it("INR is 1:1 without fetching", async () => {
    const lock = await resolveExpenseRate({
      currency: "INR",
      db: dbWith(null),
      fetchFn: failFetch,
    });
    expect(lock.rate).toBe("1.00000000");
  });
});

describe("toBaseMinor minor units", () => {
  it("USD cents -> INR paise", () => {
    expect(toBaseMinor(10000, "83.12000000")).toBe(831200);
  });
  it("JPY (0 decimals) -> INR paise", () => {
    // 1000 JPY at 0.55 INR/JPY = 550.00 INR = 55000 paise
    expect(toBaseMinor(1000, "0.55000000", 0, 2)).toBe(55000);
  });
});
