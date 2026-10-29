/** CSV helpers shared by the export route and the client-side list exports. */

/** RFC 4180 quoting plus a leading quote on cells a spreadsheet would run as a formula. */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(cells: readonly unknown[]): string {
  return `${cells.map(csvCell).join(",")}\r\n`;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return csvLine(headers) + rows.map(csvLine).join("");
}

/** Browser download of already-filtered rows (the screens that filter client-side). */
export function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
) {
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${toCsv(headers, rows)}`], { type: "text/csv" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
