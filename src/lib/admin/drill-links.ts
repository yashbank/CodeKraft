/** Dashboard/report drill-down hrefs. Params are exactly those `parseLedgerFilters` reads. */
import { startOfFy } from "@/lib/dates";
import { lastDaysRange } from "./dashboard-view";

export interface DrillRange {
  from?: string;
  to?: string;
}

export function ledgerDrillHref(f: DrillRange & { product?: string; partner?: string }): string {
  const q = new URLSearchParams();
  for (const k of ["product", "partner", "from", "to"] as const) if (f[k]) q.set(k, f[k]);
  const s = q.toString();
  return `/admin/finance/ledger${s ? `?${s}` : ""}`;
}

/** Date window of a dashboard range (same bounds the server uses for the widget data). */
export function dashboardRangeBounds(range: "7d" | "30d" | "90d" | "fy", now = new Date()) {
  if (range === "fy")
    return { from: startOfFy(now).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  const r = lastDaysRange(range === "7d" ? 7 : range === "90d" ? 90 : 30, now);
  return { from: r.dateFrom, to: r.dateTo };
}
