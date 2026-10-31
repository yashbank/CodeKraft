import ExcelJS from "exceljs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RateTable } from "@/lib/currency-convert";
import { buildXlsx, moneyNumFmt, type ExportColumn } from "@/lib/admin/export-builder";
import { convertedCells, convertedColumns } from "@/lib/admin/export-fx";
import {
  approxNote,
  approxText,
  documentMoney,
  groupedAmount,
  pdfMoney,
} from "@/lib/document-money";
import { buildInvoicePdf } from "@/modules/invoices/pdf";
import { InvoiceDocument, type InvoiceProps } from "@/pdf/Invoice";

const table: RateTable = {
  base: "INR",
  rates: { INR: "1", USD: "0.012", EUR: "0.011", GBP: "0.0095", CAD: "0.0163" },
  fetchedAt: "2026-11-01T06:00:00.000Z",
  stale: false,
  source: "test",
};

describe("document money formatting", () => {
  it("groups INR in lakhs and others in thousands", () => {
    expect(groupedAmount(12345678, "INR")).toBe("1,23,456.78");
    expect(groupedAmount(12345678, "USD")).toBe("123,456.78");
    expect(documentMoney(12345678, "INR")).toBe("₹1,23,456.78");
    expect(documentMoney(123450, "USD")).toBe("$1,234.50");
    expect(documentMoney(123450, "EUR")).toBe("€1,234.50");
    expect(documentMoney(123450, "GBP")).toBe("£1,234.50");
    expect(pdfMoney(12345678, "INR")).toBe("INR 1,23,456.78");
  });

  it("approx note only when currencies differ, converted from the table", () => {
    expect(approxNote(1000000, "INR", "INR", table)).toBeNull();
    const n = approxNote(1000000, "INR", "USD", table)!;
    expect(n).toMatchObject({ amountMinor: 12000, currency: "USD", rateDate: "2026-11-01" });
    expect(approxText(n)).toContain("≈ $120.00");
    expect(approxText(n, true)).toContain("approx. USD 120.00");
    expect(documentMoney(approxNote(120000, "USD", "INR", table)!.amountMinor, "INR")).toBe(
      "₹1,00,000.00",
    );
  });
});

const base = {
  invoiceNo: "CK/1",
  issuedAt: "2026-11-01",
  seller: { name: "CodeKraft", address: "x", gst_number: "29ABCDE1234F1Z5" },
  buyer: { name: "B", email: "b@x.com" },
  lines: [
    {
      description: "Item",
      quantity: 1,
      unit_minor: 10000000,
      discount_minor: 0,
      tax_minor: 1800000,
      total_minor: 11800000,
    },
  ],
  subtotalMinor: 10000000,
  discountMinor: 0,
  taxMinor: 1800000,
  totalMinor: 11800000,
  currency: "INR",
  gstBreakdown: { cgst_minor: 900000, sgst_minor: 900000, rate_bps: 1800 },
} as unknown as InvoiceProps;

describe("invoice outputs", () => {
  it("HTML keeps the stored currency and shows the labelled approx note", () => {
    const approx = approxNote(base.totalMinor, "INR", "USD", table);
    const h = renderToStaticMarkup(<InvoiceDocument {...base} approx={approx} />);
    expect(h).toContain("₹1,18,000.00");
    expect(h).toContain("CGST:");
    expect(h).toContain("₹9,000.00");
    expect(h).toContain("≈ $1,416.00");
    expect(renderToStaticMarkup(<InvoiceDocument {...base} />)).not.toContain("≈");
  });

  it("PDF uses code + grouping and an ASCII approx line", () => {
    const approx = approxNote(base.totalMinor, "INR", "USD", table);
    const s = buildInvoicePdf({ ...base, approx }).toString("latin1");
    expect(s).toContain("INR 1,18,000.00");
    expect(s).toContain("approx. USD 1,416.00");
  });
});

describe("export money", () => {
  it("per-currency number formats and converted columns", async () => {
    expect(moneyNumFmt("USD")).toBe('"$"#,##0.00');
    expect(moneyNumFmt("INR")).toContain("##\\,##\\,##0.00");
    const fx = { viewer: "USD", table } as const;
    expect(convertedColumns(fx).map((c) => c.header)).toEqual(["Amount (≈ USD)", "Rate date"]);
    expect(convertedCells(fx, 1000000, "INR")).toEqual(["120.00", "2026-11-01"]);
    expect(convertedCells(fx, 5000, "USD")).toEqual(["50.00", ""]);
    const cols: ExportColumn[] = [{ header: "Amt", type: "money", currency: "USD" }];
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildXlsx("T", cols, [["50.00"]])) as unknown as ArrayBuffer);
    expect(wb.worksheets[0]!.getCell("A2").numFmt).toBe('"$"#,##0.00');
  });
});
