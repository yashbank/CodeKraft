/* eslint-disable codekraft/no-float-money -- page-layout geometry and byte offsets, not money */
/**
 * PDF generation and storage for invoices, credit notes, and partner statements.
 * No PDF library is installed, so this is a small hand-rolled PDF-1.4 writer (Helvetica, A4,
 * paginated, correct xref; valid for `media.sniff.verifyMagicBytes`).
 */
import type { InvoiceProps } from "@/pdf/Invoice";
import { toDecimalString } from "@/lib/money";
import { getDocumentsBucketName, getStorageDriver } from "@/lib/storage";

const W = 595;
const H = 842;
const M = 40;

/** Embeddable image: JPEG, or non-interlaced 8-bit RGB/gray PNG (raw IDAT, no re-encode). */
export interface PdfImage {
  w: number;
  h: number;
  cs: "DeviceRGB" | "DeviceGray";
  filter: "DCTDecode" | "FlateDecode";
  data: Buffer;
  colors: number;
}

/** WinAnsi-safe text: Helvetica cannot draw glyphs above Latin-1 (e.g. the rupee sign). */
function pdfText(text: string): string {
  return text.replace(/[^\x20-\x7e\xa0-\xff]/g, "?").replace(/[()\\]/g, "\\$&");
}

/** shortcut: approximate Helvetica advance (digits exact), good enough to right-align numbers. */
function textWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) w += /[0-9]/.test(ch) ? 556 : /[.,: ]/.test(ch) ? 278 : 540;
  return (w * size) / 1000;
}

class Canvas {
  readonly pages: string[][] = [[]];
  private cur(): string[] {
    return this.pages.at(-1) ?? [];
  }
  text(x: number, y: number, s: string, size = 9, bold = false, right = false): void {
    const px = right ? x - textWidth(s, size) : x;
    this.cur().push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${px.toFixed(1)} ${y.toFixed(1)} Td (${pdfText(s)}) Tj ET`,
    );
  }
  rule(y: number, x1 = M, x2 = W - M): void {
    this.cur().push(`0.8 G ${x1} ${y} m ${x2} ${y} l S`);
  }
  image(x: number, y: number, w: number, h: number): void {
    this.cur().push(`q ${w} 0 0 ${h} ${x} ${y} cm /Im1 Do Q`);
  }
  newPage(): void {
    this.pages.push([]);
  }
}

function assemble(pages: string[][], img?: PdfImage | null): Buffer {
  const objs: Buffer[] = [];
  const add = (...parts: (string | Buffer)[]) =>
    objs.push(
      Buffer.concat(parts.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : p))),
    );
  const first = img ? 6 : 5; // object number of page 1
  const kids = pages.map((_, i) => `${first + 2 * i} 0 R`).join(" ");
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  if (img) {
    const parms =
      img.filter === "FlateDecode"
        ? ` /DecodeParms << /Predictor 15 /Colors ${img.colors} /BitsPerComponent 8 /Columns ${img.w} >>`
        : "";
    add(
      `<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /${img.cs} /BitsPerComponent 8 /Filter /${img.filter}${parms} /Length ${img.data.length} >>\nstream\n`,
      img.data,
      "\nendstream",
    );
  }
  const res = `<< /Font << /F1 3 0 R /F2 4 0 R >>${img ? " /XObject << /Im1 5 0 R >>" : ""} >>`;
  for (const [i, ops] of pages.entries()) {
    const content = ops.join("\n");
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${first + 2 * i + 1} 0 R /Resources ${res} >>`,
    );
    add(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
  }
  const out: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets: number[] = [];
  let pos = out[0]?.length ?? 0;
  objs.forEach((o, i) => {
    offsets.push(pos);
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from("\nendobj\n")]);
    out.push(b);
    pos += b.length;
  });
  const xref = [
    "xref",
    `0 ${objs.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objs.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(pos),
    "%%EOF",
  ].join("\n");
  out.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(out);
}

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/)) {
    if (cur && cur.length + 1 + word.length > max) {
      out.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
    while (cur.length > max) {
      out.push(cur.slice(0, max));
      cur = cur.slice(max);
    }
  }
  return [...out, cur];
}

/** Plain titled text document (statements, credit notes); wraps and paginates. */
export function buildPdfBuffer(title: string, lines: string[]): Buffer {
  const c = new Canvas();
  let y = H - M;
  c.text(M, y, title, 16, true);
  y -= 28;
  for (const line of lines.flatMap((l) => wrap(l, 95))) {
    if (y < M) {
      c.newPage();
      y = H - M;
    }
    c.text(M, y, line, 10);
    y -= 14;
  }
  return assemble(c.pages);
}

/**
 * Invoice layout from the stored snapshot (callers pass snapshot data, never live settings).
 * Table head repeats on every page; rows are never split.
 */
export function buildInvoicePdf(inv: InvoiceProps, logo?: PdfImage | null): Buffer {
  const c = new Canvas();
  const money = (n: number) => toDecimalString(n);
  const cur = inv.currency;
  const g = inv.gstBreakdown;
  let y = H - M;

  let hx = M;
  if (logo) {
    const h = 36;
    const w = Math.min((logo.w / logo.h) * h, 160);
    c.image(M, y - h + 10, w, h);
    hx = M + w + 12;
  }
  c.text(hx, y - 8, "TAX INVOICE", 20, true);
  y -= 34;
  c.text(M, y, `Invoice No: ${inv.invoiceNo}`, 10);
  c.text(W - M, y, `Date: ${inv.issuedAt}`, 10, false, true);
  y -= 14;
  if (inv.orderNo) {
    c.text(M, y, `Order: ${inv.orderNo}`, 10);
    y -= 14;
  }
  c.rule(y);
  y -= 18;

  const s = inv.seller;
  const b = inv.buyer;
  const sellerLines = [
    s.name,
    ...wrap(s.address, 40),
    s.gst_number ? `GSTIN: ${s.gst_number}` : "",
    s.pan ? `PAN: ${s.pan}` : "",
    s.email ? `Email: ${s.email}` : "",
    s.phone ? `Phone: ${s.phone}` : "",
  ].filter(Boolean);
  const buyerLines = [
    b.name,
    b.company ?? "",
    b.email,
    ...(b.address ? wrap(b.address, 40) : []),
    b.gst_number ? `GSTIN: ${b.gst_number}` : "",
  ].filter(Boolean);
  c.text(M, y, "Sold By", 9, true);
  c.text(320, y, "Billed To", 9, true);
  const blockTop = y - 14;
  sellerLines.forEach((l, i) => c.text(M, blockTop - i * 12, l, 9, i === 0));
  buyerLines.forEach((l, i) => c.text(320, blockTop - i * 12, l, 9, i === 0));
  y = blockTop - Math.max(sellerLines.length, buyerLines.length) * 12 - 12;

  const rate = g ? ` (${g.rate_bps / 100}%)` : "";
  const head = () => {
    c.text(M, y, "#", 9, true);
    c.text(60, y, "Description", 9, true);
    c.text(335, y, "Qty", 9, true, true);
    c.text(400, y, "Unit Price", 9, true, true);
    c.text(455, y, "Discount", 9, true, true);
    c.text(510, y, `Tax${rate}`, 9, true, true);
    c.text(W - M, y, "Total", 9, true, true);
    c.rule(y - 5);
    y -= 20;
  };
  head();
  inv.lines.forEach((l, i) => {
    const desc = wrap(l.hsn_sac ? `${l.description} (HSN/SAC ${l.hsn_sac})` : l.description, 50);
    if (y - (desc.length - 1) * 11 < M + 40) {
      c.newPage();
      y = H - M;
      head();
    }
    c.text(M, y, String(i + 1), 9);
    desc.forEach((d, k) => c.text(60, y - k * 11, d, 9));
    c.text(335, y, String(l.quantity), 9, false, true);
    c.text(400, y, money(l.unit_minor), 9, false, true);
    c.text(455, y, money(l.discount_minor), 9, false, true);
    c.text(510, y, money(l.tax_minor), 9, false, true);
    c.text(W - M, y, money(l.total_minor), 9, false, true);
    y -= desc.length * 11 + 5;
  });

  const rows: [string, string, boolean?][] = [["Subtotal:", `${cur} ${money(inv.subtotalMinor)}`]];
  if (inv.discountMinor > 0) rows.push(["Discount:", `-${cur} ${money(inv.discountMinor)}`]);
  if (g) {
    if (g.cgst_minor !== undefined) rows.push(["CGST:", `${cur} ${money(g.cgst_minor)}`]);
    if (g.sgst_minor !== undefined) rows.push(["SGST:", `${cur} ${money(g.sgst_minor)}`]);
    if (g.igst_minor !== undefined) rows.push(["IGST:", `${cur} ${money(g.igst_minor)}`]);
  } else if (inv.taxMinor > 0) rows.push(["Tax:", `${cur} ${money(inv.taxMinor)}`]);
  rows.push(["Total:", `${cur} ${money(inv.totalMinor)}`, true]);
  if (y - rows.length * 15 < M) {
    c.newPage();
    y = H - M;
  }
  c.rule(y + 8, 340);
  for (const [label, value, bold] of rows) {
    c.text(340, y - 6, label, bold ? 11 : 9, !!bold);
    c.text(W - M, y - 6, value, bold ? 11 : 9, !!bold, true);
    y -= 15;
  }
  return assemble(c.pages, logo);
}

/** Parses JPEG/PNG bytes into an embeddable image, or null when unsupported. */
export function parseLogo(buf: Buffer): PdfImage | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i + 9 < buf.length;) {
      if (buf[i] !== 0xff) return null;
      const m = buf.readUInt8(i + 1);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
        const colors = buf.readUInt8(i + 9);
        if (colors !== 1 && colors !== 3) return null; // CMYK etc. unsupported
        return {
          w: buf.readUInt16BE(i + 7),
          h: buf.readUInt16BE(i + 5),
          cs: colors === 1 ? "DeviceGray" : "DeviceRGB",
          filter: "DCTDecode",
          data: buf,
          colors,
        };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
  }
  if (buf.subarray(1, 4).toString() === "PNG") {
    const depth = buf[24];
    const type = buf[25]; // 0 gray, 2 RGB (no alpha/palette)
    if (depth !== 8 || (type !== 0 && type !== 2) || buf[28] !== 0) return null;
    const idat: Buffer[] = [];
    for (let i = 8; i + 8 <= buf.length;) {
      const len = buf.readUInt32BE(i);
      if (buf.subarray(i + 4, i + 8).toString() === "IDAT") {
        idat.push(buf.subarray(i + 8, i + 8 + len));
      }
      i += 12 + len;
    }
    return {
      w: buf.readUInt32BE(16),
      h: buf.readUInt32BE(20),
      cs: type === 0 ? "DeviceGray" : "DeviceRGB",
      filter: "FlateDecode",
      data: Buffer.concat(idat),
      colors: type === 0 ? 1 : 3,
    };
  }
  return null;
}

/** Fetches the snapshot logo (4s timeout); any failure or unsupported format yields null. */
export async function fetchLogo(url: string | null | undefined): Promise<PdfImage | null> {
  if (!url) return null;
  try {
    const u = new URL(url, process.env.NEXT_PUBLIC_SITE_URL);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const res = await fetch(u, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return parseLogo(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

/**
 * Uploads generated PDF to `codekraft-documents` storage bucket.
 */
export async function uploadDocumentPdf(
  key: string,
  buffer: Buffer,
): Promise<{ key: string; bucket: string }> {
  const driver = getStorageDriver();
  const bucket = getDocumentsBucketName();
  await driver.putObject(bucket, key, buffer, "application/pdf");
  return { key, bucket };
}
