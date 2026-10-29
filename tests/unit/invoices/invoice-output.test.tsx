import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceDocument, type InvoiceProps } from "@/pdf/Invoice";
import { inflateSync, deflateSync } from "node:zlib";
import { buildInvoicePdf, fetchLogo, parseLogo } from "@/modules/invoices/pdf";
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
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "https://cdn.example");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(jpg)));
    const img = await fetchLogo(seller.logo_url);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    expect(img?.filter).toBe("DCTDecode");
    expect(buildInvoicePdf(base, img).toString("latin1")).toContain("/Subtype /Image");
  });

  it("never fetches a logo from a foreign origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "https://cdn.example");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await fetchLogo("http://169.254.169.254/latest/meta-data")).toBeNull();
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

/** Builds a PNG (filter 0 rows) of the given colour type/depth; CRCs are not verified by our parser. */
function png(
  w: number,
  h: number,
  depth: number,
  type: number,
  rows: number[][],
  extra: [string, Buffer][] = [],
) {
  const chunk = (k: string, d: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(d.length);
    return Buffer.concat([len, Buffer.from(k), d, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = depth;
  ihdr[9] = type;
  const raw = Buffer.concat(rows.map((r) => Buffer.from([0, ...r])));
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", ihdr),
    ...extra.map(([k, d]) => chunk(k, d)),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const decoded = (img: ReturnType<typeof parseLogo>) => [...inflateSync(img!.data)];

describe("logo formats", () => {
  it("RGBA PNG: alpha flattened onto white", () => {
    const img = parseLogo(png(2, 1, 8, 6, [[255, 0, 0, 255, 255, 0, 0, 0]]));
    expect(img).toMatchObject({ w: 2, h: 1, cs: "DeviceRGB", filter: "FlateDecode" });
    expect(decoded(img)).toEqual([0, 255, 0, 0, 255, 255, 255]);
    expect(buildInvoicePdf(base, img).toString("latin1")).toContain("/Subtype /Image");
  });

  it("palette PNG (with tRNS): palette expanded", () => {
    const plte = Buffer.from([10, 20, 30, 200, 100, 50]);
    const img = parseLogo(
      png(
        2,
        1,
        8,
        3,
        [[0, 1]],
        [
          ["PLTE", plte],
          ["tRNS", Buffer.from([255, 255])],
        ],
      ),
    );
    expect(decoded(img)).toEqual([0, 10, 20, 30, 200, 100, 50]);
  });

  it("1-bit palette and 8-bit gray+alpha decode", () => {
    const plte = Buffer.from([0, 0, 0, 255, 255, 255]);
    const a = parseLogo(png(2, 1, 1, 3, [[0b01000000]], [["PLTE", plte]]));
    expect(decoded(a)).toEqual([0, 0, 0, 0, 255, 255, 255]);
    expect(decoded(parseLogo(png(1, 1, 8, 4, [[0, 0]])))).toEqual([0, 255, 255, 255]);
  });

  it("plain RGB PNG passes through; JPEG still embeds", () => {
    expect(parseLogo(png(1, 1, 8, 2, [[1, 2, 3]]))?.colors).toBe(3);
    const jpg = Buffer.from("ffd8ffc0001108000100010301002100ffd9", "hex");
    expect(parseLogo(jpg)?.filter).toBe("DCTDecode");
  });
});

describe("redesigned invoice", () => {
  const full = {
    ...base,
    discountMinor: 500,
    paymentStatus: "pending" as const,
    accent: "#0b5cad",
    notes: "Thanks for your business",
    seller: { ...seller, phone: "+91 99999 00000" },
  };
  it("HTML has every field", () => {
    const h = html(full);
    for (const t of [
      "<img",
      "border-radius",
      "#0b5cad",
      "CodeKraft Inc",
      "123 Tech Park",
      "GSTIN: 29AAAAA0000A1Z5",
      "billing@codekraft.dev",
      "+91 99999 00000",
      "Alice",
      "Invoice No: CK/2026-27/0001",
      "Order No: CK-ORD-000001",
      "Purchase Date: 2026-04-10",
      "PAYMENT PENDING",
      "HSN/SAC 998314",
      "Unit Price",
      "Discount",
      "CGST:",
      "SGST:",
      "Subtotal:",
      "Total Tax:",
      "Grand Total:",
      "118.00",
      "Thanks for your business",
    ])
      expect(h).toContain(t);
    expect(html({ gstBreakdown: { igst_minor: 1800, rate_bps: 1800 } })).toContain("IGST:");
  });

  it("PDF has numbers, status, totals; old snapshot without logo renders", () => {
    const old = { ...full, seller: { name: "Old Co", address: "x" } };
    const s = buildInvoicePdf(old).toString("latin1");
    for (const t of [
      "CK/2026-27/0001",
      "CK-ORD-000001",
      "PAYMENT PENDING",
      "Grand Total:",
      "INR 118.00",
      "Total Tax:",
      "HSN/SAC 998314",
    ])
      expect(s).toContain(t);
    expect(s).not.toContain("/Subtype /Image");
    expect(buildInvoicePdf({ ...base, paymentStatus: "refunded" }).toString("latin1")).toContain(
      "REFUNDED",
    );
  });
});
