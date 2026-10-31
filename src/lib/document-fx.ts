/**
 * Server helper for documents/exports: the viewer's display currency + a RateTable.
 * Interim until `@/modules/fx/convert` (getRateTable) lands; replace the body of `getDocRateTable`.
 */
import { approxNote, type ApproxNote } from "./document-money";
import { getRate } from "./fx";
import { CURRENCIES, type Currency } from "./money";
import type { RateTable } from "./currency-convert";

export async function getDocRateTable(): Promise<RateTable> {
  const quotes = await Promise.all(
    CURRENCIES.map(async (c) => (c === "INR" ? null : { c, ...(await getRate("INR", c)) })),
  );
  const rates: Record<Currency, string> = { INR: "1", USD: "1", EUR: "1", GBP: "1", CAD: "1" };
  for (const q of quotes) if (q) rates[q.c] = q.rate;
  const first = quotes.find((q) => q);
  return {
    base: "INR",
    rates,
    fetchedAt: first?.asOf ?? new Date().toISOString().slice(0, 10),
    stale: false,
    source: first?.source ?? "static",
  };
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
