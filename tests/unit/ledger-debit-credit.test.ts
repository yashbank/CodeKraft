import { describe, expect, it } from "vitest";
import { drCr, ledgerTotals } from "@/components/admin/format";

describe("ledger debit/credit split", () => {
  it("shows positive amounts in separate columns and totals reconcile", () => {
    expect(drCr(-4000000)).toEqual({ debit: 4000000, credit: 0 });
    expect(drCr(250)).toEqual({ debit: 0, credit: 250 });
    const amounts = [-4000000, 4000000, 250, -50];
    const t = ledgerTotals(amounts);
    expect(t).toEqual({ debits: 4000050, credits: 4000250, net: 200 });
    expect(t.net).toBe(amounts.reduce((a, b) => a + b, 0));
  });
});
