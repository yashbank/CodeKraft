/**
 * Tax helper (PHASE-03 P3.3; MASTER_SPEC §7 "Tax before GST registration", D-1501, FR-PAY-02):
 * a product's effective tax rate is `tax_rate_bps` only while the product has `tax_enabled` AND a
 * GSTIN is configured; otherwise 0. P4 checkout/invoices call this with the loaded settings.
 */
import type { SiteSettings } from "./types";

export function effectiveTaxRateBps(
  product: { taxEnabled: boolean },
  settings: Pick<SiteSettings, "taxRateBps" | "gstin">,
): number {
  if (!product.taxEnabled) return 0;
  if (settings.gstin === null || settings.gstin === "") return 0;
  return settings.taxRateBps;
}
