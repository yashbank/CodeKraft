import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted: Array<Record<string, unknown>> = [];
let prevRows: Array<Record<string, unknown>> = [];

vi.mock("@/lib/db", () => {
  // Awaited selects resolve to prevRows (limit() -> []); inserts are recorded. The db itself is
  // not thenable (it is returned from an async fn), only the query objects are.
  const q: Record<string, unknown> = {};
  for (const k of ["from", "where", "orderBy"]) q[k] = () => q;
  q.limit = () => Promise.resolve([]);
  q.then = (res: (v: unknown) => unknown) => Promise.resolve(prevRows).then(res);
  const ins: Record<string, unknown> = {
    values: (v: Record<string, unknown>) => {
      inserted.push(v);
      return ins;
    },
    onConflictDoUpdate: () => Promise.resolve(),
  };
  return { db: { select: () => q, insert: () => ins } };
});

import { fxRefreshJob } from "@/jobs/fx";

const ok = (rates: Record<string, number>) =>
  Response.json({ result: "success", base_code: "INR", rates });
const ALL = { USD: 0.012, EUR: 0.011, GBP: 0.0095, CAD: 0.0163 };

describe("fxRefreshJob", () => {
  beforeEach(() => {
    inserted.length = 0;
    prevRows = [];
  });

  it("writes both directions for every non-INR currency", async () => {
    const fetchFn = vi.fn(async () => ok(ALL)) as unknown as typeof fetch;
    const r = await fxRefreshJob.run(undefined, { fetchFn });
    expect(r.written).toBe(8);
    expect(r.source).toBe("open.er-api.com");
    const usdInr = inserted.find((v) => v.base === "USD" && v.quote === "INR");
    expect(Number(usdInr?.rate)).toBeCloseTo(83.33333, 3);
  });

  it("falls back to frankfurter when the primary fails", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (String(url).includes("open.er-api")) return new Response("no", { status: 500 });
      return Response.json({ base: "INR", rates: ALL });
    }) as unknown as typeof fetch;
    const r = await fxRefreshJob.run(undefined, { fetchFn });
    expect(r.source).toBe("frankfurter.app");
    expect(r.written).toBe(8);
  });

  it("D17-02: rejects a primary response quoted against another base", async () => {
    const fetchFn = vi.fn(async (url: string) =>
      String(url).includes("open.er-api")
        ? Response.json({ result: "success", base_code: "USD", rates: { USD: 1, EUR: 0.92 } })
        : Response.json({ base: "INR", rates: ALL }),
    ) as unknown as typeof fetch;
    const r = await fxRefreshJob.run(undefined, { fetchFn });
    expect(r.source).toBe("frankfurter.app");
  });

  const prev = (rate: string) => ({
    base: "INR",
    quote: "USD",
    rate,
    asOf: "2026-11-01",
    source: "open.er-api.com",
    createdAt: new Date(),
  });
  it("D17-02: a stored rate that fails the sanity check heals on the next refresh", async () => {
    prevRows = [prev("1.00000000")];
    const fetchFn = vi.fn(async () => ok(ALL)) as unknown as typeof fetch;
    const r = await fxRefreshJob.run(undefined, { fetchFn });
    expect(r.written).toBe(8);
    expect(
      inserted.some((v) => v.base === "INR" && v.quote === "USD" && v.rate === "0.01200000"),
    ).toBe(true);
  });
  it("D17-02: the +-20% rule still holds against a sane stored rate", async () => {
    prevRows = [prev("0.01200000")];
    const fetchFn = vi.fn(async () => ok({ ...ALL, USD: 0.0156 })) as unknown as typeof fetch;
    const r = await fxRefreshJob.run(undefined, { fetchFn });
    expect(r.written).toBe(6);
  });
  it("D17-02: a USD-based primary (FX_API_URL=/latest/USD) is re-based to INR", async () => {
    const usd = { INR: 83.33333333, USD: 1, EUR: 0.91666667, GBP: 0.79166667, CAD: 1.35833333 };
    const fetchFn = vi.fn(async () =>
      Response.json({ result: "success", base_code: "USD", rates: usd }),
    ) as unknown as typeof fetch;
    const r = await fxRefreshJob.run(undefined, { fetchFn });
    expect(r.source).not.toBe("frankfurter.app");
    const usdRow = inserted.find((v) => v.base === "INR" && v.quote === "USD");
    expect(Number(usdRow?.rate)).toBeCloseTo(0.012, 6);
  });
  it("never throws when every provider is down; writes nothing", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const r = await fxRefreshJob.run(undefined, { fetchFn });
    expect(r.written).toBe(0);
    expect(r.error).toMatch(/All FX providers failed/);
  });

  it("rejects a rate outside the +-20% bound vs a recent previous rate", async () => {
    prevRows = [
      {
        base: "INR",
        quote: "USD",
        rate: "0.01200000",
        asOf: "2026-10-31",
        source: "open.er-api.com",
        createdAt: new Date(),
      },
    ];
    const fetchFn = vi.fn(async () => ok({ USD: 0.03, EUR: 0.011 })) as unknown as typeof fetch;
    const r = await fxRefreshJob.run(undefined, { fetchFn });
    expect(inserted.some((v) => v.quote === "USD" && v.base === "INR")).toBe(false);
    expect(inserted.some((v) => v.quote === "EUR" && v.base === "INR")).toBe(true);
    expect(r.error).toMatch(/sanity bound/);
  });

  it("a timeout is reported, not thrown", async () => {
    const fetchFn = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    }) as unknown as typeof fetch;
    await expect(fxRefreshJob.run(undefined, { fetchFn })).resolves.toMatchObject({ written: 0 });
  });
});
