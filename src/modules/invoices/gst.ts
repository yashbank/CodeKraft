/**
 * GST classification and breakdown (BR-08, D-504, D-1501, docs/06 API-COM-11). Pure integer
 * arithmetic: CGST/SGST halves are split with the odd paise going to CGST so both sum exactly.
 *
 * Rules: no seller GSTIN → no GST at all (`none`, tax lines absent); buyer outside India → `export`
 * (IGST at the order rate); same state code (first two GSTIN digits) → `cgst_sgst`; else `igst`.
 */
import type { GstBreakdown } from "../../../drizzle/schema/invoices";

export type GstKind = "cgst_sgst" | "igst" | "export" | "none";

/** First two characters of a GSTIN are the state code. */
export function gstStateCode(gstin: string | null | undefined): string | null {
  if (typeof gstin !== "string") return null;
  const g = gstin.trim().toUpperCase();
  return /^[0-9]{2}[0-9A-Z]{13}$/.test(g) ? g.slice(0, 2) : null;
}

export interface GstClassification {
  kind: GstKind;
  sellerState: string | null;
  buyerState: string | null;
}

export function classifyGst(input: {
  sellerGstin: string | null;
  buyerGstNumber?: string | null;
  buyerCountry: string;
}): GstClassification {
  const sellerState = gstStateCode(input.sellerGstin);
  const buyerState = gstStateCode(input.buyerGstNumber);
  if (input.sellerGstin === null || input.sellerGstin === "") {
    return { kind: "none", sellerState: null, buyerState };
  }
  if (input.buyerCountry.toUpperCase() !== "IN") return { kind: "export", sellerState, buyerState };
  if (buyerState !== null && sellerState !== null && buyerState === sellerState) {
    return { kind: "cgst_sgst", sellerState, buyerState };
  }
  return { kind: "igst", sellerState, buyerState };
}

/** `null` when no GSTIN (D-1501) or no tax; otherwise the split in minor units. */
export function gstBreakdown(taxMinor: number, rateBps: number, kind: GstKind): GstBreakdown | null {
  if (kind === "none" || taxMinor <= 0 || rateBps <= 0) return null;
  if (kind === "cgst_sgst") {
    const sgst = BigInt(taxMinor) / 2n;
    const cgst = BigInt(taxMinor) - sgst;
    return { cgst_minor: Number(cgst), sgst_minor: Number(sgst), rate_bps: rateBps };
  }
  return { igst_minor: taxMinor, rate_bps: rateBps };
}
