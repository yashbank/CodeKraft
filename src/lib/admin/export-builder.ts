/** The ONE export builder: every admin list/route turns columns + rows into a styled .xlsx or a plain CSV here. Server-only. */
import ExcelJS from "exceljs";

import { toCsv } from "./csv";

export type ExportColType = "text" | "money" | "num" | "date" | "int";
export type ExportColumn = { header: string; type?: ExportColType; width?: number };
export type ExportFormat = "xlsx" | "csv";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const HEADER_FILL = "FF1E3A5F";
export const FONT_NAME = "Calibri";
export const MONEY_FMT = '"₹"#,##0.00';
const FMT = { money: MONEY_FMT, num: "#,##0.00##", date: "yyyy-mm-dd", int: "#,##0" } as const;

/** Coerce a raw cell (string or number) to what the column type needs; unparsable values stay text. */
function typed(v: unknown, t: ExportColType): unknown {
  if (v == null || v === "") return null;
  if (t === "money" || t === "num" || t === "int") {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : String(v);
  }
  if (t === "date") {
    const d = v instanceof Date ? v : new Date(String(v));
    return Number.isNaN(d.getTime()) ? String(v) : d;
  }
  return v;
}

export async function buildXlsx(
  sheet: string,
  columns: readonly ExportColumn[],
  rows: readonly (readonly unknown[])[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  const font = { name: FONT_NAME, size: 11 };
  ws.columns = columns.map((c, i) => {
    const t = c.type ?? "text";
    // shortcut: width from the first 200 rows, not the whole sheet; fine for exports of this shape.
    const len = Math.max(
      c.header.length,
      ...rows.slice(0, 200).map((r) => String(r[i] ?? "").length),
    );
    return {
      header: c.header,
      width: c.width ?? Math.min(48, Math.max(12, len + 3)),
      style: { font, ...(t !== "text" ? { numFmt: FMT[t] } : {}) },
    };
  });
  for (const r of rows) {
    ws.addRow(
      columns.map((c, i) => {
        const v = typed(r[i], c.type ?? "text");
        // Formula-injection guard: only strings (never numbers/dates) starting = + - @ get a quote.
        return typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
      }),
    );
  }
  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell((cell) => {
    cell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle" };
    cell.numFmt = "@";
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function buildCsv(
  columns: readonly ExportColumn[],
  rows: readonly (readonly unknown[])[],
): string {
  return `\uFEFF${toCsv(
    columns.map((c) => c.header),
    rows,
  )}`;
}

export const exportFormat = (v: unknown): ExportFormat => (v === "xlsx" ? "xlsx" : "csv");

export async function exportResponse(
  format: ExportFormat,
  name: string,
  columns: readonly ExportColumn[],
  rows: readonly (readonly unknown[])[],
): Promise<Response> {
  const base = `${name.replace(/[^\w-]+/g, "_")}-${new Date().toISOString().slice(0, 10)}`;
  const body =
    format === "xlsx"
      ? new Uint8Array(await buildXlsx(name, columns, rows))
      : buildCsv(columns, rows);
  return new Response(body, {
    headers: {
      "content-type": format === "xlsx" ? XLSX_MIME : "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${base}.${format}"`,
      "cache-control": "no-store",
    },
  });
}
