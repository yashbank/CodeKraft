/**
 * Admin currency display: amounts stored in the entering admin's currency render in the VIEWING
 * admin's currency. Known table: 1 INR = 0.011 EUR (1 EUR = 90.909... INR).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RateTable } from "@/lib/currency-convert";
import {
  formatViewed,
  sumInViewerCurrency,
  viewLocked,
  viewMoney,
  type AdminCurrencyConfig,
} from "@/lib/admin/currency-view";
import { AdminCurrencyProvider } from "@/components/admin/AdminCurrency";
import { MoneyCell } from "@/components/admin/MoneyCell";

const table: RateTable = {
  base: "INR",
  rates: { INR: "1", USD: "0.012", EUR: "0.011", GBP: "0.0095", CAD: "0.0163" },
  fetchedAt: "2026-11-01T00:00:00.000Z",
  stale: false,
  source: "test",
};
const eurAdmin: AdminCurrencyConfig = { currency: "EUR", table };
const inrAdmin: AdminCurrencyConfig = { currency: "INR", table };

// Admin Yash entered INR 500; admin B entered EUR 200.
const yashAmount = { amountMinor: 50_000, currency: "INR" } as const;
const bAmount = { amountMinor: 20_000, currency: "EUR" } as const;

describe("viewMoney", () => {
  it("leaves same-currency amounts untouched", () => {
    expect(viewMoney(yashAmount, inrAdmin)).toEqual({
      amountMinor: 50_000,
      currency: "INR",
      approx: false,
    });
    expect(viewMoney(bAmount, eurAdmin).approx).toBe(false);
  });

  it("converts INR 500 to EUR 5.50 for an EUR admin and keeps the stored original", () => {
    const v = viewMoney(yashAmount, eurAdmin);
    expect(v).toMatchObject({ amountMinor: 550, currency: "EUR", approx: true });
    expect(v.original).toEqual(yashAmount);
    expect(formatViewed(v)).toBe("≈ €5.50");
  });

  it("converts EUR 200 to INR 18,181.82 for an INR admin", () => {
    const v = viewMoney(bAmount, inrAdmin);
    expect(v).toMatchObject({ amountMinor: 1_818_182, currency: "INR", approx: true });
    expect(v.original).toEqual(bAmount);
  });
});

describe("sumInViewerCurrency", () => {
  it("aggregates mixed-currency rows in the viewer's single currency", () => {
    expect(sumInViewerCurrency([yashAmount, bAmount], eurAdmin)).toEqual({
      amountMinor: 20_550,
      currency: "EUR",
    });
    expect(sumInViewerCurrency([yashAmount, bAmount], inrAdmin)).toEqual({
      amountMinor: 1_868_182,
      currency: "INR",
    });
  });
});

describe("viewLocked", () => {
  it("uses the locked INR amount, not today's rate, for historical rows", () => {
    // Expense of EUR 200 posted when 1 EUR = 100 INR (locked INR 20,000.00); today it is 90.91.
    const v = viewLocked(bAmount, 2_000_000, inrAdmin);
    expect(v.amountMinor).toBe(2_000_000);
    expect(v.original).toEqual(bAmount);
    // A USD admin sees the locked INR converted at the current INR->USD rate.
    const usd = viewLocked(bAmount, 2_000_000, { currency: "USD", table });
    expect(usd.amountMinor).toBe(24_000);
  });

  it("falls back to the live table when no locked amount is known", () => {
    expect(viewLocked(bAmount, undefined, inrAdmin).amountMinor).toBe(1_818_182);
  });
});

describe("MoneyCell", () => {
  it("shows the converted amount with the stored original as secondary text", () => {
    render(
      <AdminCurrencyProvider currency="EUR" table={table}>
        <MoneyCell value={yashAmount} />
      </AdminCurrencyProvider>,
    );
    expect(screen.getByText(/≈\s*€5\.50/)).toBeInTheDocument();
    expect(screen.getByText("₹500.00")).toBeInTheDocument();
  });

  it("renders the stored amount only when the viewer's currency matches", () => {
    render(
      <AdminCurrencyProvider currency="INR" table={table}>
        <MoneyCell value={yashAmount} />
      </AdminCurrencyProvider>,
    );
    expect(screen.getByText("₹500.00")).toBeInTheDocument();
    expect(screen.queryByText(/≈/)).toBeNull();
  });
});
