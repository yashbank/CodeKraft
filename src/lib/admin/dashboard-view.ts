/** Maps the finance `revenue_by_period` report rows to dashboard bar-chart points (minor units). */
export function mapRevenueByPeriod(
  rows: ReadonlyArray<Record<string, unknown>>,
): Array<{ label: string; value: number }> {
  return rows.map((r) => ({
    label: String(r.period ?? ""),
    value: typeof r.netMinor === "number" ? r.netMinor : 0,
  }));
}

/** Inclusive ISO-date window ending today (UTC) and covering the last `days` days. */
export function lastDaysRange(days: number, now: Date = new Date()) {
  const from = new Date(now.getTime() - (days - 1) * 86_400_000);
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: now.toISOString().slice(0, 10) };
}
