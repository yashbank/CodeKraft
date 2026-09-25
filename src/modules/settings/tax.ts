/**
 * Tax computation helpers (docs/06 §4.1, MASTER_SPEC §7 "Tax before GST registration", PHASE-03 P3.3).
 * Tax rate is 0 until a valid GSTIN is registered, even if taxEnabled is true on the product.
 */

export interface TaxableProduct {
  taxEnabled?: boolean;
}

export interface TaxSettings {
  taxRateBps: number;
  gstin?: string | null;
}

/**
 * Computes the effective tax rate in basis points (bps).
 * Returns 0 if:
 * 1. Product has taxEnabled === false
 * 2. Settings has no GSTIN or empty GSTIN
 * 3. Settings taxRateBps <= 0
 */
export function effectiveTaxRateBps(
  productOrSettings?: TaxableProduct | TaxSettings | null,
  maybeSettings?: TaxSettings | null,
): number {
  if (!productOrSettings) return 0;

  // Overload: called as effectiveTaxRateBps(settings)
  if ("taxRateBps" in productOrSettings && maybeSettings === undefined) {
    const settings = productOrSettings as TaxSettings;
    if (!settings.gstin || settings.gstin.trim().length === 0) return 0;
    return Math.max(0, settings.taxRateBps ?? 0);
  }

  const product = productOrSettings as TaxableProduct;
  if (product.taxEnabled === false) return 0;

  if (!maybeSettings || !maybeSettings.gstin || maybeSettings.gstin.trim().length === 0) {
    return 0;
  }

  return Math.max(0, maybeSettings.taxRateBps ?? 0);
}
