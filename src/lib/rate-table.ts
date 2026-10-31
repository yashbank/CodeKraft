/**
 * Server helper: builds the shared `RateTable` (units per 1 INR) from the FX provider, cached 5 min.
 * Interim stand-in for `modules/fx/convert.getRateTable` (same name/shape): swap the import when it lands.
 */
import { convertWithTable, type RateTable } from "./currency-convert";
import { getFxProvider } from "./fx";
import { CURRENCIES, type Currency } from "./money";

const TTL_MS = 5 * 60 * 1000;
let memo: { at: number; table: RateTable } | null = null;

export async function getRateTable(): Promise<RateTable> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.table;
  const provider = getFxProvider();
  const rates = { INR: "1" } as Record<Currency, string>;
  let source = "static";
  let stale = false;
  await Promise.all(
    CURRENCIES.filter((c) => c !== "INR").map(async (c) => {
      try {
        const q = await provider.getRate("INR", c);
        rates[c] = q.rate;
        source = q.source;
      } catch {
        stale = true;
        rates[c] = "0";
      }
    }),
  );
  const table: RateTable = {
    base: "INR",
    rates,
    fetchedAt: new Date().toISOString(),
    stale,
    source,
  };
  memo = { at: Date.now(), table };
  return table;
}

/** Test hook. */
export function resetRateTableCache(): void {
  memo = null;
}

/** Convert from the stored currency to the viewer's. Throws RangeError when a rate is missing. */
export async function convertAmount(
  amountMinor: number,
  from: Currency,
  to: Currency,
): Promise<number> {
  if (from === to) return amountMinor;
  return convertWithTable(amountMinor, from, to, await getRateTable());
}
