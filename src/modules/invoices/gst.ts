/**
 * GST breakdown rules (D-1501, BR-08, MASTER_SPEC §7 "Tax before GST registration").
 */
import type { GstBreakdown } from "./types";

export interface ComputeGstInput {
  buyerState?: string | null;
  sellerState?: string | null;
  taxMinor: number;
  taxRateBps: number;
  gstin?: string | null;
}

/**
 * Computes GST breakdown:
 * - When `gstin` is missing/empty, returns undefined (no tax breakdown).
 * - When `taxMinor` is 0, returns undefined.
 * - When `buyerState` === `sellerState` (intra-state): splits equally into CGST & SGST.
 * - Otherwise (inter-state / foreign): puts entire tax in IGST.
 */
export function computeGstBreakdown(input: ComputeGstInput): GstBreakdown | undefined {
  if (!input.gstin || input.gstin.trim() === "" || input.taxMinor <= 0) {
    return undefined;
  }

  const bState = input.buyerState?.trim().toLowerCase();
  const sState = input.sellerState?.trim().toLowerCase() || "29"; // default Karnataka

  const isIntraState = Boolean(bState && sState && bState === sState);

  if (isIntraState) {
    const cgst = Math.round(input.taxMinor / 2);
    const sgst = input.taxMinor - cgst;
    return {
      cgst_minor: cgst,
      sgst_minor: sgst,
      rate_bps: input.taxRateBps,
    };
  }

  return {
    igst_minor: input.taxMinor,
    rate_bps: input.taxRateBps,
  };
}
