/** Hover/focus tooltip + aria text for a bar: exact value and share of the total. */
export function formatBarTooltip(
  label: string,
  value: number,
  total: number,
  formatValue: (v: number) => string,
): string {
  const share = total > 0 ? ` (${Math.round((value / total) * 100)}%)` : "";
  return `${label}: ${formatValue(value)}${share}`;
}
