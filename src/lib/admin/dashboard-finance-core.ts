/** Pure money maths for the dashboard finance widgets, sharing definitions with finance reports. */
import { deriveMetrics, type RawLedgerSums } from "@/modules/finance/metrics-core";

/** "My share" = the admin's partner shares for the selected range, via the finance metric definition. */
export function buildMyShare(raw: RawLedgerSums, weeklySeries: number[]) {
  const valueInr = deriveMetrics(raw).partnerSharesMinor;
  const thisWeek = weeklySeries.at(-1) ?? 0;
  const lastWeek = weeklySeries.at(-2) ?? 0;
  return {
    valueInr,
    delta:
      valueInr === 0
        ? "No allocations in this period"
        : `This week ₹${(thisWeek / 100).toFixed(0)} vs ₹${(lastWeek / 100).toFixed(0)} last week`,
    sparkline: weeklySeries,
  };
}
