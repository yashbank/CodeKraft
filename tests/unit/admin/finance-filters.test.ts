import { describe, expect, it } from "vitest";

import {
  filterAdjustmentRows,
  filterAllocationOrders,
  filterAllocationRows,
  filterExpenseRows,
  filterPayoutRows,
  filterReportByPartner,
  inDateRange,
  parseAllocationFilters,
  parseExpenseFilters,
  parseLedgerFilters,
  parseReportFilters,
  parseStatusFilters,
} from "@/lib/admin/finance-filters";
import type { AdjustmentRow, AllocationRow, ExpenseRow, PayoutRow } from "@/components/admin/types";
import type { ReportResult } from "@/modules/finance/types";

const PARTNER = "11111111-1111-4111-8111-111111111111";
const PRODUCT = "22222222-2222-4222-8222-222222222222";
const m = (amountMinor: number) => ({ amountMinor, currency: "INR" as const });

describe("ledger params -> query filter", () => {
  it("maps every supported param", () => {
    expect(
      parseLedgerFilters({
        from: "2026-10-01",
        to: "2026-10-31",
        type: "payout",
        party: "partner",
        partner: PARTNER,
        ccy: "USD",
        q: "ck-ord-000123",
      }),
    ).toEqual({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
      entryType: ["payout"],
      partyType: "partner",
      partnerId: PARTNER,
      currency: "USD",
      orderNo: "CK-ORD-000123",
    });
  });
  it("drops garbage instead of failing validation, and swaps a reversed range", () => {
    expect(
      parseLedgerFilters({ from: "2026-13-40", type: "nope", partner: "x", ccy: "ZZZ", q: "abc" }),
    ).toEqual({});
    expect(parseLedgerFilters({ from: "2026-10-31", to: "2026-10-01" })).toEqual({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
    });
  });
});

describe("allocations", () => {
  const orders = [
    { orderNo: "CK-ORD-000001", createdAt: "2026-10-01T23:30:00.000Z" },
    { orderNo: "CK-ORD-000002", createdAt: "2026-10-02T00:00:00.000Z" },
    { orderNo: "CK-ORD-000103", createdAt: "2026-10-31T23:59:59.999Z" },
  ];
  it("date range is inclusive of both whole days; q matches order number", () => {
    const f = parseAllocationFilters({ from: "2026-10-02", to: "2026-10-31" });
    expect(filterAllocationOrders(orders, f).map((o) => o.orderNo)).toEqual([
      "CK-ORD-000002",
      "CK-ORD-000103",
    ]);
    expect(
      filterAllocationOrders(orders, parseAllocationFilters({ q: "000103" })).map((o) => o.orderNo),
    ).toEqual(["CK-ORD-000103"]);
  });
  it("filters rows by product, partner and ownership version", () => {
    const row = (id: string, product: string, partner: string, v: string) =>
      ({
        id,
        product,
        ownershipVersion: v,
        partners: [{ name: partner, bps: 5000, amount: m(1) }],
      }) as unknown as AllocationRow;
    const rows = [row("a", "Alpha", "Priya", "v1"), row("b", "Beta", "Arjun", "v2")];
    const ids = (f: Record<string, string>) =>
      filterAllocationRows(rows, parseAllocationFilters(f)).map((r) => r.id);
    expect(ids({})).toEqual(["a", "b"]);
    expect(ids({ product: "Beta" })).toEqual(["b"]);
    expect(ids({ partner: "Priya" })).toEqual(["a"]);
    expect(ids({ version: "v2" })).toEqual(["b"]);
    expect(ids({ product: "Alpha", version: "v2" })).toEqual([]);
  });
});

describe("expenses", () => {
  const rows = [
    { id: "1", at: "2026-10-01", description: "Vercel plan", category: "Hosting" },
    { id: "2", at: "2026-10-15", description: "Design", category: "Contractors", product: "Alpha" },
    { id: "3", at: "2026-10-31", description: "Domain", category: "Hosting" },
  ] as ExpenseRow[];
  const ids = (sp: Record<string, string>) =>
    filterExpenseRows(rows, parseExpenseFilters(sp)).map((r) => r.id);
  it("parses product as uuid or the company sentinel", () => {
    expect(parseExpenseFilters({ product: PRODUCT }).product).toBe(PRODUCT);
    expect(parseExpenseFilters({ product: "company" }).product).toBe("company");
    expect(parseExpenseFilters({ product: "bogus" }).product).toBeUndefined();
  });
  it("applies date (inclusive), category, company-only and text", () => {
    expect(ids({ from: "2026-10-15", to: "2026-10-31" })).toEqual(["2", "3"]);
    expect(ids({ to: "2026-10-01" })).toEqual(["1"]);
    expect(ids({ category: "Hosting" })).toEqual(["1", "3"]);
    expect(ids({ product: "company" })).toEqual(["1", "3"]);
    expect(ids({ q: "vercel" })).toEqual(["1"]);
  });
});

describe("adjustments + payouts", () => {
  it("filters by status", () => {
    const adj = [{ status: "pending" }, { status: "applied" }] as AdjustmentRow[];
    expect(filterAdjustmentRows(adj, parseStatusFilters({ status: "applied" }))).toHaveLength(1);
    expect(filterAdjustmentRows(adj, parseStatusFilters({}))).toHaveLength(2);
  });
  it("filters payouts by status, partner name and reference/note", () => {
    const pay = [
      { id: "1", status: "applied", partner: "Priya", reference: "UTR1", note: "Oct" },
      { id: "2", status: "pending", partner: "Arjun", reference: "UTR2" },
    ] as PayoutRow[];
    const ids = (f: Parameters<typeof filterPayoutRows>[1]) =>
      filterPayoutRows(pay, f).map((p) => p.id);
    expect(ids({ status: "pending" })).toEqual(["2"]);
    expect(ids({ partner: "Priya" })).toEqual(["1"]);
    expect(ids({ q: "utr2" })).toEqual(["2"]);
    expect(ids({ q: "oct", status: "pending" })).toEqual([]);
  });
});

describe("reports", () => {
  const now = new Date("2026-10-29T10:00:00Z");
  it("resolves presets in UTC and honours custom dates", () => {
    expect(parseReportFilters({}, now)).toMatchObject({
      preset: "this-fy",
      dateFrom: "2026-04-01",
      dateTo: "2026-10-29",
    });
    expect(parseReportFilters({ preset: "last-month" }, now)).toMatchObject({
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
    });
    expect(parseReportFilters({ preset: "last-fy" }, now)).toMatchObject({
      dateFrom: "2025-04-01",
      dateTo: "2026-03-31",
    });
    expect(
      parseReportFilters({ preset: "custom", from: "2026-01-05", to: "2026-02-06" }, now),
    ).toMatchObject({ dateFrom: "2026-01-05", dateTo: "2026-02-06" });
    // custom range params are ignored for non-custom presets
    expect(parseReportFilters({ preset: "this-month", from: "2020-01-01" }, now).dateFrom).toBe(
      "2026-10-01",
    );
  });
  it("passes granularity, currency and partner only when valid", () => {
    expect(parseReportFilters({ gran: "day", ccy: "native", partner: PARTNER }, now)).toMatchObject(
      {
        granularity: "day",
        currency: "native",
        partnerId: PARTNER,
      },
    );
    const bad = parseReportFilters({ gran: "week", ccy: "inr", partner: "x" }, now);
    expect(bad.granularity).toBeUndefined();
    expect(bad.currency).toBeUndefined();
    expect(bad.partnerId).toBeUndefined();
  });
  it("keeps one partner's rows and re-sums money totals", () => {
    const result = {
      report: "revenue_by_partner",
      columns: [
        { key: "partnerId", label: "Partner ID", kind: "text" },
        { key: "netMinor", label: "Net", kind: "money" },
      ],
      rows: [
        { partnerId: PARTNER, netMinor: 100 },
        { partnerId: "other", netMinor: 50 },
      ],
      totals: { netMinor: 150 },
      currency: "INR",
    } as unknown as ReportResult;
    const out = filterReportByPartner(result, PARTNER);
    expect(out.rows).toHaveLength(1);
    expect(out.totals.netMinor).toBe(100);
    expect(filterReportByPartner(result, undefined)).toBe(result);
  });
});

describe("inDateRange", () => {
  it("is inclusive on both ends and open-ended", () => {
    expect(inDateRange("2026-10-31T23:59:59Z", "2026-10-01", "2026-10-31")).toBe(true);
    expect(inDateRange("2026-11-01T00:00:00Z", "2026-10-01", "2026-10-31")).toBe(false);
    expect(inDateRange("2020-01-01", undefined, undefined)).toBe(true);
  });
});
