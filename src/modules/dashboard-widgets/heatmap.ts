/**
 * Weekday x hour bucketing for the "orders_heatmap" dashboard widget (P14-12a). Pure, so the
 * server loader and the unit tests share it. Rows are Monday..Sunday, columns hours 0..23 in the
 * business timezone (IST, a fixed +05:30 offset: India has no DST).
 */
export const HEATMAP_DAYS = 90;
export const IST_OFFSET_MINUTES = 330;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface HeatmapData {
  /** grid[weekday 0=Mon..6=Sun][hour 0..23] = count */
  grid: number[][];
  total: number;
  max: number;
}

export const emptyHeatmap = (): HeatmapData => ({
  grid: WEEKDAYS.map(() => Array.from({ length: 24 }, () => 0)),
  total: 0,
  max: 0,
});

export function bucketWeekdayHour(
  dates: ReadonlyArray<Date | string>,
  offsetMinutes = IST_OFFSET_MINUTES,
): HeatmapData {
  const out = emptyHeatmap();
  for (const d of dates) {
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    const local = new Date(t + offsetMinutes * 60_000);
    const row = out.grid[(local.getUTCDay() + 6) % 7] as number[];
    const hour = local.getUTCHours();
    row[hour] = (row[hour] ?? 0) + 1;
    out.total += 1;
    out.max = Math.max(out.max, row[hour] as number);
  }
  return out;
}
