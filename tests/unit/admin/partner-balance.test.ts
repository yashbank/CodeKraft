import { describe, expect, it } from "vitest";

import { computePartnerRollup, computeStatementPreview } from "@/lib/admin/finance-view";
import { drCr, ledgerTotals } from "@/components/admin/format";
import type { LedgerEntryView } from "@/modules/finance/types";

const entry = (
  seq: number,
  entryType: LedgerEntryView["entryType"],
  amountInrMinor: number,
  createdAt = "2026-10-05T10:00:00.000Z",
): LedgerEntryView =>
  ({
    entryId: `e${seq}`,
    seq,
    entryType,
    amountInrMinor,
    createdAt,
    links: { orderNo: `CK-ORD-00000${seq}`, orderId: null },
  }) as unknown as LedgerEntryView;

describe("partner balance = allocations - payouts", () => {
  // Credits are positive, debits negative (a payout is a debit against the partner).
  const entries = [
    entry(1, "partner_allocation", 100_000),
    entry(2, "partner_allocation", 50_000),
    entry(3, "payout", -40_000),
  ];

  it("balance (sum of signed lines) drops by exactly the payout", () => {
    const before = entries.slice(0, 2).reduce((s, e) => s + e.amountInrMinor, 0);
    const after = entries.reduce((s, e) => s + e.amountInrMinor, 0);
    expect(before).toBe(150_000);
    expect(after).toBe(110_000);
    expect(before - after).toBe(40_000);
  });

  it("rollup reports earned and paid-out as positive amounts and closes at the balance", () => {
    const r = computePartnerRollup(entries, 110_000);
    expect(r.earnedInrMinor).toBe(150_000);
    expect(r.paidOutInrMinor).toBe(40_000);
    expect(r.earnedInrMinor - r.paidOutInrMinor).toBe(110_000);
    expect(r.history[0]?.closing).toBe(110_000);
  });

  it("statement closing = opening + allocations - payouts", () => {
    const s = computeStatementPreview({
      partnerName: "Priya",
      period: "Oct",
      openingBalanceInrMinor: 10_000,
      entries,
    });
    expect(s.payouts).toBe(-40_000);
    expect(s.closing).toBe(10_000 + 150_000 - 40_000);
  });
});

describe("ledger sign convention", () => {
  it("splits into positive debit/credit columns and net = credits - debits", () => {
    expect(drCr(-40_000)).toEqual({ debit: 40_000, credit: 0 });
    expect(drCr(150_000)).toEqual({ debit: 0, credit: 150_000 });
    expect(ledgerTotals([150_000, -40_000])).toEqual({
      credits: 150_000,
      debits: 40_000,
      net: 110_000,
    });
  });
});
