import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceDocument, type InvoiceProps } from "@/pdf/Invoice";
import { buildInvoicePdf, fetchLogo } from "@/modules/invoices/pdf";
import { computeGstBreakdown } from "@/modules/invoices/gst";

const seller = {
  name: "CodeKraft Inc",
  address: "123 Tech Park, Bengaluru",
  gst_number: "29AAAAA0000A1Z5",
  email: "billing@codekraft.dev",
  logo_url: "https://cdn.example/logo.png",
};
const line = (i: number) => ({
  description: `Item ${i}`,
  quantity: 2,
  unit_minor: 5000,
  discount_minor: 0,
  tax_minor: 1800,
  total_minor: 11800,
  hsn_sac: "998314",
});
const base: InvoiceProps = {
  invoiceNo: "CK/2026-27/0001",
  issuedAt: "2026-04-10",
  orderNo: "CK-ORD-000001",
  seller,
  buyer: { name: "Alice", email: "a@x.com", country: "IN", address: "Pune", state_code: "27" },
  lines: [line(1)],
  subtotalMinor: 10000,
  discountMinor: 0,
  taxMinor: 1800,
  totalMinor: 11800,
  currency: "INR",
  gstBreakdown: { cgst_minor: 900, sgst_minor: 900, rate_bps: 1800 },
};
const html = (p: Partial<InvoiceProps> = {}) =>
  renderToStaticMarkup(<InvoiceDocument {...base} {...p} />);

describe("invoice HTML", () => {
  it("renders every required field", () => {
    const h = html();
    for (const t of [
      "CodeKraft Inc",
      "123 Tech Park",
      "GSTIN: 29AAAAA0000A1Z5",
      "billing@codekraft.dev",
      "logo.png",
      "Alice",
      "CK/2026-27/0001",
      "2026-04-10",
      "CK-ORD-000001",
      "Item 1",
      "50.00",
      "18%",
      "118.00",
      "CGST:",
      "SGST:",
    ])
      expect(h).toContain(t);
  });

  it("40 lines: repeating thead and print css", () => {
    const h = html({ lines: Array.from({ length: 40 }, (_, i) => line(i)) });
    expect(h).toContain("table-header-group");
    expect(h).toContain("break-inside:avoid");
    expect(h).toContain("size:A4");
    expect(h.match(/<thead>/g)).toHaveLength(1);
    expect(h).toContain("Item 39");
  });

  it("old snapshot without logo_url renders; tax shown without GST split", () => {
    const h = html({ seller: { name: "Old Co", address: "x" }, gstBreakdown: null });
    expect(h).toContain("Old Co");
    expect(h).not.toContain("<img");
    expect(h).toContain("Tax:");
  });
});

describe("GST split", () => {
  it("intra-state is CGST+SGST, inter-state is IGST, both reconcile", () => {
    const intra = computeGstBreakdown({
      buyerState: "29",
      sellerState: "29",
      taxMinor: 1801,
      taxRateBps: 1800,
      gstin: "G",
    })!;
    expect(intra.igst_minor).toBeUndefined();
    expect(intra.cgst_minor! + intra.sgst_minor!).toBe(1801);
    const inter = computeGstBreakdown({
      buyerState: "27",
      sellerState: "29",
      taxMinor: 1801,
      taxRateBps: 1800,
      gstin: "G",
    })!;
    expect(inter.cgst_minor).toBeUndefined();
    expect(inter.igst_minor).toBe(1801);
    expect(base.subtotalMinor - base.discountMinor + base.taxMinor).toBe(base.totalMinor);
  });
});

describe("invoice PDF", () => {
  it("is a real PDF with seller, number and total", () => {
    const s = buildInvoicePdf(base).toString("latin1");
    expect(s.startsWith("%PDF-")).toBe(true);
    for (const t of ["CodeKraft Inc", "CK/2026-27/0001", "118.00", "CGST:"]) expect(s).toContain(t);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("paginates 40 lines with a repeated head", () => {
    const s = buildInvoicePdf({
      ...base,
      lines: Array.from({ length: 40 }, (_, i) => line(i)),
    }).toString("latin1");
    expect(s.match(/\/Type \/Page /g)!.length).toBeGreaterThan(1);
    expect(s.match(/\(Description\)/g)!.length).toBeGreaterThan(1);
  });

  it("logo fetch failure does not break the PDF", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await fetchLogo(seller.logo_url)).toBeNull();
    vi.unstubAllGlobals();
    expect(buildInvoicePdf(base, null).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("embeds a JPEG logo", async () => {
    // minimal SOI + SOF0 (1x1, 3 comps) header is enough for dimension parsing
    const jpg = Buffer.from("ffd8ffc0001108000100010301002100ffd9", "hex");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(jpg)));
    const img = await fetchLogo(seller.logo_url);
    vi.unstubAllGlobals();
    expect(img?.filter).toBe("DCTDecode");
    expect(buildInvoicePdf(base, img).toString("latin1")).toContain("/Subtype /Image");
  });
});
