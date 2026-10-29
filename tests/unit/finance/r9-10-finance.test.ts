import { beforeEach, describe, expect, it, vi } from "vitest";
import { drCr, ledgerTotals, runningBalances } from "@/components/admin/format";
import { parseLedgerFilters } from "@/lib/admin/finance-filters";

let partnerRow: { id: string } | undefined;
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => (partnerRow ? [partnerRow] : []) }) }),
    }),
  },
}));
let userId = "";
vi.mock("@/modules/auth/service", () => ({
  getSession: async () => ({ user: { id: userId }, session: { id: "s1" } }),
}));
vi.mock("@/modules/auth/roles-port", () => ({ loadRoles: async () => ["super_admin"] }));
vi.mock("@/lib/authz/must-change", () => ({ assertNoPasswordChange: () => undefined }));

describe("ledger: credit 40,000 then spend 2", () => {
  const amounts = [-200, 4_000_000]; // newest first, minor units
  it("spend shows as a debit of exactly 2.00, credit of 40,000.00", () => {
    expect(drCr(-200)).toEqual({ debit: 200, credit: 0 });
    expect(drCr(4_000_000)).toEqual({ debit: 0, credit: 4_000_000 });
    expect(ledgerTotals(amounts)).toEqual({ debits: 200, credits: 4_000_000, net: 3_999_800 });
  });
  it("running balance is 40,000 then 39,998", () => {
    expect(runningBalances(amounts)).toEqual([3_999_800, 4_000_000]);
  });
});

describe("my share = the logged-in admin's own partner", () => {
  beforeEach(() => vi.resetModules());
  it.each([
    ["CEO", "user-ceo", "partner-ceo"],
    ["CFO", "user-cfo", "partner-cfo"],
  ])("%s context carries their own partnerId", async (_n, uid, pid) => {
    userId = uid;
    partnerRow = { id: pid };
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    expect((await getAdminRequestContext()).partnerId).toBe(pid);
  });
  it("a user with no partner row has no partnerId", async () => {
    userId = "user-x";
    partnerRow = undefined;
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    expect((await getAdminRequestContext()).partnerId).toBeUndefined();
  });
});

describe("ledger filter query builder", () => {
  it("full order number -> orderNo, other text -> search (never silently ignored)", () => {
    expect(parseLedgerFilters({ q: "ck-ord-000123" })).toEqual({ orderNo: "CK-ORD-000123" });
    expect(parseLedgerFilters({ q: "hosting" })).toEqual({ search: "HOSTING" });
    expect(parseLedgerFilters({ q: "000123" })).toHaveProperty("search");
  });
  it("combines date, type, party, currency", () => {
    expect(
      parseLedgerFilters({
        from: "2026-10-01",
        to: "2026-10-31",
        type: "expense",
        party: "company",
        ccy: "INR",
      }),
    ).toEqual({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
      entryType: ["expense"],
      partyType: "company",
      currency: "INR",
    });
  });
});
