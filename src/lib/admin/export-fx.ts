/**
 * Export columns that carry the viewer-currency conversion next to the original amount.
 * Original (amount + currency) stays the source of truth; the converted column is labelled
 * "≈ <viewer>" and a "Rate date" column records which rate table produced it.
 */
import type { RateTable } from "@/lib/currency-convert";
import { convertWithTable } from "@/lib/currency-convert";
import { isCurrency, type Currency } from "@/lib/money";
import type { ExportColumn } from "./export-builder";

export interface ExportFx {
  viewer: Currency;
  table: RateTable;
}

/** Viewer currency + rate table for the current request (server only). */
export async function loadExportFx(): Promise<ExportFx> {
  const { getDocRateTable, viewerCurrency } = await import("@/lib/document-fx");
  const [viewer, table] = await Promise.all([viewerCurrency(), getDocRateTable()]);
  return { viewer, table };
}

export const convertedColumns = (fx: ExportFx): ExportColumn[] => [
  { header: `Amount (≈ ${fx.viewer})`, type: "money", currency: fx.viewer },
  { header: "Rate date", width: 12 },
];

/** Cells matching `convertedColumns`: original minor amount -> viewer currency, plus the rate date. */
export function convertedCells(
  fx: ExportFx,
  amountMinor: number,
  currency: string,
): [string, string] {
  if (!isCurrency(currency)) return ["", ""];
  try {
    const v = convertWithTable(amountMinor, currency, fx.viewer, fx.table);
    return [(v / 100).toFixed(2), currency === fx.viewer ? "" : fx.table.fetchedAt.slice(0, 10)];
  } catch {
    return ["", ""];
  }
}
