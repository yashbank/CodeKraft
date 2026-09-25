/**
 * Minimal RFC 4180 CSV writer for audit exports (API-ADM-05, D-1104). Cells are quoted when they
 * contain a comma, quote, CR or LF; JSON columns are serialised compactly. A leading `=`, `+`,
 * `-`, `@` is prefixed with `'` so spreadsheets never evaluate a cell (formula injection).
 */

export function csvCell(value: unknown): string {
  let text: string;
  if (value === null || value === undefined) text = "";
  else if (typeof value === "string") text = value;
  else if (value instanceof Date) text = value.toISOString();
  else if (typeof value === "object") text = JSON.stringify(value);
  else text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function csvLine(cells: readonly unknown[]): string {
  return cells.map(csvCell).join(",");
}

/** Header + rows, CRLF-terminated lines, with a UTF-8 BOM for Excel. */
export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const lines = [csvLine(header), ...rows.map(csvLine)];
  return `﻿${lines.join("\r\n")}\r\n`;
}
