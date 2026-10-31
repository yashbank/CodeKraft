/**
 * Server helper for documents/exports: the viewer's display currency + a RateTable.
 * Interim until `@/modules/fx/convert` (getRateTable) lands; replace the body of `getDocRateTable`.
 */
import { approxNote, type ApproxNote } from "./document-money";
import type { Currency } from "./money";
import type { RateTable } from "./currency-convert";

export async function getDocRateTable(): Promise<RateTable> {
  const { getRateTable } = await import("@/modules/fx/convert");
  return getRateTable();
}

export async function viewerCurrency(): Promise<Currency> {
  try {
    const { getDisplayCurrency } = await import("./display-currency");
    return (await getDisplayCurrency()).currency;
  } catch {
    return "INR";
  }
}

/** Approx note for a stored amount in the viewer currency, or null when none applies / fx unavailable. */
export async function documentApprox(
  amountMinor: number,
  stored: string,
): Promise<ApproxNote | null> {
  try {
    const viewer = await viewerCurrency();
    if (viewer === stored) return null;
    return approxNote(amountMinor, stored, viewer, await getDocRateTable());
  } catch {
    return null;
  }
}
