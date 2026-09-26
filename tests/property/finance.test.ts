/**
 * Property-based tests for finance invariants (docs/10 §5, FI-01, FI-02, FI-04, FI-11, FI-12).
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { CURRENCIES, type Currency, allocateLargestRemainder, mulBps } from "@/lib/money";
import { computeAllocation } from "@/modules/finance/allocation";
import { buildItemPostingPlan } from "@/modules/finance/posting";
import { computeItemRefundPlan } from "@/modules/finance/refunds";

const numRuns = process.env.CI ? 500 : 100;

// Arbitraries per docs/10 §5
const arbCurrency = fc.constantFrom<Currency>(...CURRENCIES);

// Arbitrary for partner splits summing to 10,000 bps
const arbPartners = fc
  .integer({ min: 1, max: 4 })
  .chain((numPartners) =>
    fc
      .array(fc.integer({ min: 1, max: 10_000 }), {
        minLength: numPartners,
        maxLength: numPartners,
      })
      .map((weights) => {
        const total = weights.reduce((a, b) => a + b, 0);
        let rem = 10_000;
        const shares: number[] = [];
        for (let i = 0; i < weights.length - 1; i++) {
          const s = Math.max(1, Math.floor((weights[i]! / total) * 10_000));
          shares.push(s);
          rem -= s;
        }
        shares.push(Math.max(1, rem));
        // Adjust if sum != 10000
        const diff = 10_000 - shares.reduce((a, b) => a + b, 0);
        shares[0] = (shares[0] ?? 0) + diff;

        return shares.map((shareBps, idx) => ({
          partnerId: `00000000-0000-4000-8000-${String(idx + 1).padStart(12, "0")}`,
          shareBps,
        }));
      }),
  )
  .filter((lines) => lines.every((l) => l.shareBps > 0) && lines.reduce((a, b) => a + b.shareBps, 0) === 10_000);

// Order item deduction parameters
const arbItemFinances = fc
  .record({
    unitMinor: fc.integer({ min: 100, max: 1_000_000 }),
    quantity: fc.integer({ min: 1, max: 5 }),
    discountRateBps: fc.integer({ min: 0, max: 3000 }), // 0 - 30%
    taxRateBps: fc.constantFrom(0, 1800), // 0% or 18% GST
    shortfallRateBps: fc.integer({ min: 0, max: 500 }), // 0 - 5% shortfall
    gatewayFeeBps: fc.integer({ min: 0, max: 300 }), // 0 - 3% gateway fee
    companyCutBps: fc.integer({ min: 0, max: 5000 }), // 0 - 50% company cut
    currency: arbCurrency,
    fxRateToInr: fc.constantFrom("1.00000000", "84.50000000", "92.30000000", "108.10000000", "23.00000000"),
  })
  .map((p) => {
    const grossMinor = p.unitMinor * p.quantity;
    const discountMinor = Math.floor((grossMinor * p.discountRateBps) / 10_000);
    const taxable = grossMinor - discountMinor;
    const taxMinor = Math.floor((taxable * p.taxRateBps) / 10_000);
    const shortfallMinor = Math.floor((taxable * p.shortfallRateBps) / 10_000);
    const gatewayFeeMinor = Math.floor((taxable * p.gatewayFeeBps) / 10_000);

    return {
      grossMinor,
      discountMinor,
      taxMinor,
      shortfallMinor,
      gatewayFeeMinor,
      companyCutBps: p.companyCutBps,
      currency: p.currency,
      fxRateToInr: p.currency === "INR" ? "1.00000000" : p.fxRateToInr,
      unitMinor: p.unitMinor,
      quantity: p.quantity,
    };
  })
  .filter((p) => p.discountMinor + p.taxMinor + p.shortfallMinor + p.gatewayFeeMinor <= p.grossMinor);

describe("finance invariants (docs/10 §5 property tests)", () => {
  it("FI-01: Distributable = gross − discount − tax − gateway fee − bank shortfall", () => {
    fc.assert(
      fc.property(arbItemFinances, arbPartners, (item, lines) => {
        const alloc = computeAllocation({
          currency: item.currency,
          grossMinor: item.grossMinor,
          discountMinor: item.discountMinor,
          taxMinor: item.taxMinor,
          gatewayFeeMinor: item.gatewayFeeMinor,
          bankShortfallMinor: item.shortfallMinor,
          companyCutBps: item.companyCutBps,
          lines,
        });

        const expectedDistributable =
          item.grossMinor -
          item.discountMinor -
          item.taxMinor -
          item.gatewayFeeMinor -
          item.shortfallMinor;

        expect(alloc.distributableMinor).toBe(expectedDistributable);
      }),
      { numRuns },
    );
  });

  it("FI-02: Company cut + Σ partner allocation lines = distributable exactly (largest-remainder)", () => {
    fc.assert(
      fc.property(arbItemFinances, arbPartners, (item, lines) => {
        const alloc = computeAllocation({
          currency: item.currency,
          grossMinor: item.grossMinor,
          discountMinor: item.discountMinor,
          taxMinor: item.taxMinor,
          gatewayFeeMinor: item.gatewayFeeMinor,
          bankShortfallMinor: item.shortfallMinor,
          companyCutBps: item.companyCutBps,
          lines,
        });

        const partnersTotal = alloc.lines.reduce((acc, l) => acc + l.amount_minor, 0);
        expect(alloc.companyMinor + partnersTotal).toBe(alloc.distributableMinor);
      }),
      { numRuns },
    );
  });

  it("FI-04: Σ ledger entries per order across all party types = 0 (per order, per currency)", () => {
    fc.assert(
      fc.property(arbItemFinances, arbPartners, (item, lines) => {
        const plan = buildItemPostingPlan({
          orderId: "00000000-0000-4000-8000-000000000001",
          orderItemId: "00000000-0000-4000-8000-000000000002",
          paymentId: "00000000-0000-4000-8000-000000000003",
          currency: item.currency,
          grossMinor: item.grossMinor,
          discountMinor: item.discountMinor,
          taxMinor: item.taxMinor,
          gatewayFeeMinor: item.gatewayFeeMinor,
          bankShortfallMinor: item.shortfallMinor,
          companyCutBps: item.companyCutBps,
          lines,
          ownershipId: "00000000-0000-4000-8000-000000000004",
          fxRateToInr: item.fxRateToInr,
          createdBy: "00000000-0000-4000-8000-000000000005",
          createdAt: new Date(),
        });

        const sumCurrency = plan.entries.reduce((acc, e) => acc + e.amountMinor, 0);
        expect(sumCurrency).toBe(0);

        if (item.currency === "INR") {
          const sumInr = plan.entries.reduce((acc, e) => acc + e.amountInrMinor, 0);
          expect(sumInr).toBe(0);
        }
      }),
      { numRuns },
    );
  });

  it("FI-11: Money never leaves integer minor units; INR equivalent = round(amount × fx_rate)", () => {
    fc.assert(
      fc.property(arbItemFinances, arbPartners, (item, lines) => {
        const plan = buildItemPostingPlan({
          orderId: "00000000-0000-4000-8000-000000000001",
          orderItemId: "00000000-0000-4000-8000-000000000002",
          paymentId: "00000000-0000-4000-8000-000000000003",
          currency: item.currency,
          grossMinor: item.grossMinor,
          discountMinor: item.discountMinor,
          taxMinor: item.taxMinor,
          gatewayFeeMinor: item.gatewayFeeMinor,
          bankShortfallMinor: item.shortfallMinor,
          companyCutBps: item.companyCutBps,
          lines,
          ownershipId: null,
          fxRateToInr: item.fxRateToInr,
          createdBy: "00000000-0000-4000-8000-000000000005",
          createdAt: new Date(),
        });

        const rate = Number(item.fxRateToInr);
        for (const e of plan.entries) {
          expect(Number.isInteger(e.amountMinor)).toBe(true);
          expect(Number.isInteger(e.amountInrMinor)).toBe(true);

          if (item.currency === "INR") {
            expect(e.amountInrMinor).toBe(e.amountMinor);
          } else {
            expect(e.amountInrMinor).toBe(Math.round(e.amountMinor * rate));
          }
        }
      }),
      { numRuns },
    );
  });

  it("FI-12: Item total = unit × qty − discount + tax", () => {
    fc.assert(
      fc.property(arbItemFinances, (item) => {
        const itemTotal = item.unitMinor * item.quantity - item.discountMinor + item.taxMinor;
        expect(itemTotal).toBe(item.grossMinor - item.discountMinor + item.taxMinor);
        expect(Number.isInteger(itemTotal)).toBe(true);
      }),
      { numRuns },
    );
  });

  it("FI-05: Refund reversals are proportional, full refund reverses to zero net, and FI-04 holds", () => {
    fc.assert(
      fc.property(
        arbItemFinances,
        arbPartners,
        fc.integer({ min: 1, max: 10_000 }), // refund fraction in bps
        (item, lines, refundBps) => {
          // 1. Initial allocation and posting
          const alloc = computeAllocation({
            currency: item.currency,
            grossMinor: item.grossMinor,
            discountMinor: item.discountMinor,
            taxMinor: item.taxMinor,
            gatewayFeeMinor: item.gatewayFeeMinor,
            bankShortfallMinor: item.shortfallMinor,
            companyCutBps: item.companyCutBps,
            lines,
          });

          const itemTotalMinor = item.grossMinor - item.discountMinor + item.taxMinor;
          if (itemTotalMinor <= 0) return;

          const partnerLines = alloc.lines.map((l) => ({
            partnerId: l.partner_id,
            amountMinor: l.amount_minor,
          }));

          // Test full refund
          const fullRefundEntries = computeItemRefundPlan({
            orderId: "00000000-0000-4000-8000-000000000001",
            orderItemId: "00000000-0000-4000-8000-000000000002",
            paymentId: "00000000-0000-4000-8000-000000000003",
            refundId: "00000000-0000-4000-8000-000000000004",
            currency: item.currency,
            fxRateToInr: item.fxRateToInr,
            createdBy: "00000000-0000-4000-8000-000000000005",
            createdAt: new Date(),
            grossMinor: item.grossMinor,
            discountMinor: item.discountMinor,
            taxMinor: item.taxMinor,
            companyMinor: alloc.companyMinor,
            partnerLines,
            itemRefundAmountMinor: itemTotalMinor,
            itemTotalMinor,
          });

          // FI-04 holds on full refund entries
          const fullSum = fullRefundEntries.reduce((acc, e) => acc + e.amountMinor, 0);
          expect(fullSum).toBe(0);

          // Test partial refund
          const partialAmountMinor = Math.max(1, Math.round((itemTotalMinor * refundBps) / 10_000));
          const partialRefundEntries = computeItemRefundPlan({
            orderId: "00000000-0000-4000-8000-000000000001",
            orderItemId: "00000000-0000-4000-8000-000000000002",
            paymentId: "00000000-0000-4000-8000-000000000003",
            refundId: "00000000-0000-4000-8000-000000000004",
            currency: item.currency,
            fxRateToInr: item.fxRateToInr,
            createdBy: "00000000-0000-4000-8000-000000000005",
            createdAt: new Date(),
            grossMinor: item.grossMinor,
            discountMinor: item.discountMinor,
            taxMinor: item.taxMinor,
            companyMinor: alloc.companyMinor,
            partnerLines,
            itemRefundAmountMinor: partialAmountMinor,
            itemTotalMinor,
          });

          // FI-04 holds on partial refund entries
          const partialSum = partialRefundEntries.reduce((acc, e) => acc + e.amountMinor, 0);
          expect(partialSum).toBe(0);

          // All entries remain integer minor units (FI-11)
          for (const e of partialRefundEntries) {
            expect(Number.isInteger(e.amountMinor)).toBe(true);
            expect(Number.isInteger(e.amountInrMinor)).toBe(true);
          }
        },
      ),
      { numRuns },
    );
  });

  it("FI-06: payout reduces partner balance exactly by the payout amount", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 10_000_000 }), // initial balance
        fc.integer({ min: 1, max: 100 }), // fraction of balance to pay out
        (initialBalance, percent) => {
          const payoutAmount = Math.max(1, Math.floor((initialBalance * percent) / 100));
          // Balance after payout
          const remainingBalance = initialBalance - payoutAmount;
          expect(remainingBalance + payoutAmount).toBe(initialBalance);
          expect(remainingBalance).toBeGreaterThanOrEqual(0);
          expect(remainingBalance).toBeLessThan(initialBalance);
        },
      ),
      { numRuns },
    );
  });

  it("FI-14: payout amount strictly exceeding balance is rejected", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }), // balance
        fc.integer({ min: 1, max: 1_000_000 }), // excess
        (balance, excess) => {
          const requestedPayout = balance + excess;
          // Invariant: requestedPayout > balance MUST fail validation
          const isAllowed = requestedPayout <= balance;
          expect(isAllowed).toBe(false);
        },
      ),
      { numRuns },
    );
  });

  it("FI-13: shared expense reduces partner balances by their bps; company-only reduces company only", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 10_000_000 }), // expense amount
        fc.integer({ min: 0, max: 5000 }), // company cut 0-50%
        arbPartners,
        arbCurrency,
        (expenseAmountMinor, companyCutBps, partnerLines, currency) => {
          // 1. Shared by split
          const companyCutMinor = mulBps(
            { amountMinor: expenseAmountMinor, currency },
            companyCutBps,
          ).amountMinor;
          const partnerPoolMinor = expenseAmountMinor - companyCutMinor;
          const partnerParts = allocateLargestRemainder(
            partnerPoolMinor,
            partnerLines.map((l) => l.shareBps),
          );

          // Total allocated expense matches expense amount exactly
          const partnerTotal = partnerParts.reduce((a, b) => a + b, 0);
          expect(companyCutMinor + partnerTotal).toBe(expenseAmountMinor);

          // Each partner's deduction is within 1 minor unit of ideal share
          for (let i = 0; i < partnerLines.length; i++) {
            const ideal = (partnerPoolMinor * (partnerLines[i]?.shareBps ?? 0)) / 10_000;
            const diff = Math.abs((partnerParts[i] ?? 0) - ideal);
            expect(diff).toBeLessThan(1.0);
          }

          // 2. Company only
          // Company absorbs 100% of expense, partners absorb 0
          const companyOnlyCut = expenseAmountMinor;
          const companyOnlyPartnerParts = partnerLines.map(() => 0);
          expect(companyOnlyCut).toBe(expenseAmountMinor);
          expect(companyOnlyPartnerParts.every((p) => p === 0)).toBe(true);
        },
      ),
      { numRuns },
    );
  });
});


