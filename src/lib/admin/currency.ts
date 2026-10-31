/**
 * Server helper for admin currency: the signed-in admin's preferred currency plus a RateTable.
 * Interim path until A1's `modules/fx/convert.ts#getRateTable` lands: build the table from the
 * DB-backed fx service (which already falls back to the static table) and swap the body of
 * `loadAdminRateTable` for `getRateTable()` then. The shape (`RateTable`) is the shared contract.
 */
import { CURRENCIES, type Currency } from "@/lib/money";
import type { RateTable } from "@/lib/currency-convert";
import { FALLBACK_RATE_TABLE, resolveAdminCurrency } from "./currency-view";

export async function loadAdminRateTable(): Promise<RateTable> {
  try {
    const { fxService } = await import("@/modules/fx/service");
    const rates = { ...FALLBACK_RATE_TABLE.rates } as Record<Currency, string>;
    let stale = false;
    let source = "static";
    await Promise.all(
      CURRENCIES.filter((c) => c !== "INR").map(async (c) => {
        const q = await fxService.getRate({ base: "INR", quote: c });
        rates[c] = q.rate;
        stale ||= q.source === "static";
        source = q.source;
      }),
    );
    return { base: "INR", rates, fetchedAt: new Date().toISOString(), stale, source };
  } catch {
    return FALLBACK_RATE_TABLE;
  }
}

/** Preferred currency of the signed-in admin (session user's `displayCurrency`, default INR). */
export function adminPreferredCurrency(user: { displayCurrency?: unknown } | undefined): Currency {
  return resolveAdminCurrency(user?.displayCurrency);
}
