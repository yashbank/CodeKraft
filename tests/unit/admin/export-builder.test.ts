import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { csvCell } from "@/lib/admin/csv";
import {
  buildCsv,
  buildXlsx,
  FONT_NAME,
  HEADER_FILL,
  MONEY_FMT,
  type ExportColumn,
} from "@/lib/admin/export-builder";

const cols: ExportColumn[] = [
  { header: "Name" },
  { header: "Amount INR", type: "money" },
  { header: "Joined", type: "date" },
  { header: "Orders", type: "int" },
];

async function parse(rows: unknown[][]) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await buildXlsx("Test", cols, rows)) as unknown as ArrayBuffer);
  return wb.worksheets[0]!;
}

describe("export builder xlsx", () => {
  it("styles the header, freezes it, sizes columns and formats numbers", async () => {
    const ws = await parse([["Asha", "1234.5", "2026-10-29", "3"]]);
    const h = ws.getCell("A1");
    expect(h.font?.bold).toBe(true);
    expect(h.font?.name).toBe(FONT_NAME);
    expect(h.fill).toMatchObject({ fgColor: { argb: HEADER_FILL } });
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    for (let i = 1; i <= 4; i++) expect(ws.getColumn(i).width).toBeGreaterThanOrEqual(12);
    const amount = ws.getCell("B2");
    expect(amount.value).toBe(1234.5);
    expect(amount.numFmt).toBe(MONEY_FMT);
    expect(ws.getCell("C2").value).toBeInstanceOf(Date);
    expect(ws.getCell("D2").numFmt).toBe("#,##0");
  });

  it("guards formula injection in text cells", async () => {
    const ws = await parse([["=HYPERLINK(1)", "-5", null, null]]);
    expect(ws.getCell("A2").value).toBe("'=HYPERLINK(1)");
    expect(ws.getCell("B2").value).toBe(-5);
  });
});

describe("export builder csv", () => {
  it("escapes commas, quotes, newlines and guards formulas", () => {
    expect(csvCell('a,b "q"\nx')).toBe('"a,b ""q""\nx"');
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("@x")).toBe("'@x");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-1")).toBe("'-1");
    const out = buildCsv(cols, [["a,b", 1, "d", 2]]);
    expect(out.startsWith("﻿Name,Amount INR,Joined,Orders\r\n")).toBe(true);
    expect(out).toContain('"a,b",1,d,2');
  });
});
