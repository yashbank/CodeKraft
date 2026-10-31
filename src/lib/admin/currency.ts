/**
 * Server helper for admin currency: the signed-in admin's preferred currency plus a RateTable.
 * Rates come from `modules/fx/convert#getRateTable`; falls back to the static table on error.
 */
import type { Currency } from "@/lib/money";
import type { RateTable } from "@/lib/currency-convert";
import { FALLBACK_RATE_TABLE, resolveAdminCurrency } from "./currency-view";

export async function loadAdminRateTable(): Promise<RateTable> {
  try {
    const { getRateTable } = await import("@/modules/fx/convert");
    return await getRateTable();
  } catch {
    return FALLBACK_RATE_TABLE;
  }
}

/** Preferred currency of the signed-in admin (session user's `displayCurrency`, default INR). */
export function adminPreferredCurrency(user: { displayCurrency?: unknown } | undefined): Currency {
  return resolveAdminCurrency(user?.displayCurrency);
}
