import { crossRateScaled, type RateTable } from "@/lib/currency-convert";
import { FX_RATE_SCALE, type Currency } from "@/lib/money";

export interface InrFxRow {
  quote: Currency;
  /** Units of `quote` per 1 INR. */
  rate: string;
  asOf: string;
  source: string;
  fetchedAt: string;
  stale: boolean;
}

/** Re-bases INR->X panel rows to "1 <viewer> = r <X>"; the INR row reuses the viewer's own metadata. */
export function viewerFxRows(rows: InrFxRow[], viewer: Currency): InrFxRow[] {
  if (viewer === "INR" || rows.length === 0) return rows;
  const mine = rows.find((r) => r.quote === viewer);
  if (!mine) return rows;
  const t = { base: "INR", rates: { INR: "1" } } as unknown as RateTable;
  for (const r of rows) t.rates[r.quote] = r.rate;
  const fmt = (c: Currency) => {
    const s = crossRateScaled(viewer, c, t).toString().padStart(FX_RATE_SCALE + 1, "0");
    return `${s.slice(0, -FX_RATE_SCALE)}.${s.slice(-FX_RATE_SCALE)}`;
  };
  return [{ ...mine, quote: "INR" as Currency }, ...rows.filter((r) => r.quote !== viewer)].map(
    (r) => ({ ...r, rate: fmt(r.quote) }),
  );
}
