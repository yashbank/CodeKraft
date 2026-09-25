/**
 * Order totals (docs/06 API-COM-01/02/07, BR-08, D-519, FI-12). Integer minor units only:
 * `tax = round_half_up((unit × qty − discount) × taxRateBps / 10000)` via `lib/money.mulBps`, and
 * order-level discounts are spread across lines with the largest-remainder helper.
 */
import { type Currency, type Money, allocateLargestRemainder, assertMinor, mulBps } from "@/lib/money";
import type { CheckoutLine } from "./types";

export interface LineInput {
  description: string;
  unitMinor: number;
  quantity: number;
  /** Discount already attributed to this line (minor units). */
  discountMinor?: number;
}

/** One priced line: discount is capped at the gross, tax applies to the discounted amount. */
export function computeLine(line: LineInput, taxRateBps: number, currency: Currency): CheckoutLine {
  assertMinor(line.unitMinor, "unitMinor");
  if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
    throw new RangeError("quantity must be a positive integer");
  }
  const gross = line.unitMinor * line.quantity;
  assertMinor(gross, "line gross");
  const discountMinor = Math.min(assertMinor(line.discountMinor ?? 0, "discountMinor"), gross);
  const taxable: Money = { amountMinor: gross - discountMinor, currency };
  const taxMinor = mulBps(taxable, taxRateBps).amountMinor;
  return {
    description: line.description,
    unitMinor: line.unitMinor,
    quantity: line.quantity,
    discountMinor,
    taxMinor,
    totalMinor: gross - discountMinor + taxMinor,
  };
}

export interface OrderTotals {
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
}

export function sumLines(lines: readonly CheckoutLine[], currency: Currency): OrderTotals {
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  for (const l of lines) {
    subtotal += l.unitMinor * l.quantity;
    discount += l.discountMinor;
    tax += l.taxMinor;
  }
  return {
    subtotal: { amountMinor: assertMinor(subtotal, "subtotal"), currency },
    discount: { amountMinor: discount, currency },
    tax: { amountMinor: tax, currency },
    total: { amountMinor: subtotal - discount + tax, currency },
  };
}

/**
 * Spread an order-level discount across lines pro-rata by line gross (largest remainder, Σ exact);
 * the discount is first capped at the order gross so no line ever goes negative.
 */
export function spreadDiscount(discountMinor: number, lineGross: readonly number[]): number[] {
  assertMinor(discountMinor, "discountMinor");
  if (lineGross.length === 0) return [];
  const gross = lineGross.reduce((a, b) => a + b, 0);
  const capped = Math.min(discountMinor, gross);
  if (capped === 0) return lineGross.map(() => 0);
  if (gross === 0) return lineGross.map((_, i) => (i === 0 ? capped : 0));
  return allocateLargestRemainder(capped, lineGross);
}

/** Convenience for the single-offering checkout: one line, quantity 1. */
export function priceSingleLine(input: {
  description: string;
  unitMinor: number;
  discountMinor: number;
  taxRateBps: number;
  currency: Currency;
}): { line: CheckoutLine; totals: OrderTotals } {
  const line = computeLine(
    { description: input.description, unitMinor: input.unitMinor, quantity: 1, discountMinor: input.discountMinor },
    input.taxRateBps,
    input.currency,
  );
  return { line, totals: sumLines([line], input.currency) };
}
