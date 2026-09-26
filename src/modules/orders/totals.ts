/**
 * Order and item totals calculation (FI-12, docs/06 §2.3, §4.1).
 *
 * Implements round-half-up tax calculation and exact minor-unit totals.
 */
import { divRoundHalfUp, toSafeNumber } from "@/lib/money";

export interface ItemPricingInput {
  unitMinor: number;
  quantity: number;
  discountMinor?: number;
  taxRateBps?: number;
}

export interface ItemPricingResult {
  unitMinor: number;
  quantity: number;
  grossMinor: number;
  discountMinor: number;
  taxableMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export function calculateItemPricing(input: ItemPricingInput): ItemPricingResult {
  const quantity = Math.max(1, input.quantity);
  const unitMinor = input.unitMinor;
  const grossMinor = unitMinor * quantity;
  const discountMinor = Math.min(grossMinor, Math.max(0, input.discountMinor ?? 0));
  const taxableMinor = Math.max(0, grossMinor - discountMinor);
  const taxRateBps = Math.max(0, input.taxRateBps ?? 0);

  // Round half up on tax
  const taxBig = divRoundHalfUp(
    BigInt(taxableMinor) * BigInt(taxRateBps),
    10_000n,
  );
  const taxMinor = toSafeNumber(taxBig, "taxMinor");

  // FI-12: item total = unit * qty - discount + tax
  const totalMinor = grossMinor - discountMinor + taxMinor;

  return {
    unitMinor,
    quantity,
    grossMinor,
    discountMinor,
    taxableMinor,
    taxMinor,
    totalMinor,
  };
}

export interface OrderTotalsResult {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export function calculateOrderTotals(items: readonly ItemPricingResult[]): OrderTotalsResult {
  let subtotalMinor = 0;
  let discountMinor = 0;
  let taxMinor = 0;
  let totalMinor = 0;

  for (const item of items) {
    subtotalMinor += item.grossMinor;
    discountMinor += item.discountMinor;
    taxMinor += item.taxMinor;
    totalMinor += item.totalMinor;
  }

  return {
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor,
  };
}
