/* eslint-disable codekraft/no-float-money -- page-layout geometry and byte offsets, not money */
/**
 * PDF generation and storage for invoices, credit notes, and partner statements.
 * No PDF library is installed, so this is a small hand-rolled PDF-1.4 writer (Helvetica, A4,
 * paginated, correct xref; valid for `media.sniff.verifyMagicBytes`).
 */
import { inflateSync, deflateSync } from "node:zlib";
import { DEFAULT_NOTE, PAYMENT_LABEL, type InvoiceProps } from "@/pdf/Invoice";
import { toDecimalString } from "@/lib/money";
import { getDocumentsBucketName, getStorageDriver } from "@/lib/storage";

const W = 595;
const H = 842;
const M = 40;

/** Embeddable image: JPEG, or a decoded PNG (alpha flattened onto white, palette expanded). */
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
  text(x: number, y: number, s: string, size = 9, bold = false, right = false, rgb = "0 g"): void {
    const px = right ? x - textWidth(s, size) : x;
    this.cur().push(
      `${rgb} BT /${bold ? "F2" : "F1"} ${size} Tf ${px.toFixed(1)} ${y.toFixed(1)} Td (${pdfText(s)}) Tj ET`,
    );
  }
  rect(x: number, y: number, w: number, h: number, rgb: string): void {
    this.cur().push(`${rgb} rg ${x} ${y} ${w} ${h} re f`);
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

const TOTAL_BOX_H = 24;
/**
 * Baselines of the totals rows and the bottom of the Grand Total box. The box top sits clear of
 * the last row's text (it used to overlap it, hiding Discount / Total Tax).
 */
export function totalsLayout(y0: number, n: number): { rowYs: number[]; boxY: number } {
  const rowYs = Array.from({ length: n }, (_, i) => y0 - 8 - i * 15);
  const last = rowYs.at(-1) ?? y0;
  return { rowYs, boxY: last - 8 - TOTAL_BOX_H };
}

/**
 * Invoice layout from the seller/brand props the caller resolved (callers pass snapshot data, never live settings).
 * Table head repeats on every page; rows are never split.
 */
export function buildInvoicePdf(inv: InvoiceProps, logo?: PdfImage | null): Buffer {
  const c = new Canvas();
  const money = (n: number) => toDecimalString(n);
  const cur = inv.currency;
  const g = inv.gstBreakdown;
  const acc = hexToRgb(inv.accent);
  const fill = `${acc} rg`;
  const WHITE = "1 g";
  const ZEBRA = "0.955 0.96 0.97";
  const INK = "0.07 0.09 0.15 rg";
  const MUTED = "0.42 0.45 0.5 rg";
  let y = H - M;

  // Clean header: logo + seller name left, title and invoice meta right, accent rule beneath.
  let hx = M;
  if (logo) {
    const h = 40;
    const w = Math.min((logo.w / logo.h) * h, 140);
    c.image(M, H - M - h + 6, w, h);
    hx = M + w + 14;
  }
  c.text(hx, H - M - 8, inv.seller.name, 13, true, false, INK);
  c.text(W - M, H - M - 8, "TAX INVOICE", 20, true, true, fill);
  c.text(W - M, H - M - 28, `Invoice No: ${inv.invoiceNo}`, 9, true, true, INK);
  if (inv.orderNo) c.text(W - M, H - M - 41, `Order No: ${inv.orderNo}`, 9, false, true, MUTED);
  c.text(W - M, H - M - 54, `Purchase Date: ${inv.issuedAt}`, 9, false, true, MUTED);
  c.rect(M, H - M - 66, W - 2 * M, 2, acc);
  y = H - M - 90;
  const status = PAYMENT_LABEL[inv.paymentStatus ?? "paid"];
  c.rect(M, y - 4, textWidth(status, 9) + 20, 18, acc);
  c.text(M + 10, y + 1, status, 9, true, false, WHITE);
  y -= 30;

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
  c.text(M, y, "SOLD BY", 8, true, false, fill);
  c.text(320, y, "BILLED TO", 8, true, false, fill);
  const blockTop = y - 14;
  sellerLines.forEach((l, i) => c.text(M, blockTop - i * 12, l, 9, i === 0, false, INK));
  buyerLines.forEach((l, i) => c.text(320, blockTop - i * 12, l, 9, i === 0, false, INK));
  y = blockTop - Math.max(sellerLines.length, buyerLines.length) * 12 - 14;

  const rate = g ? ` (${g.rate_bps / 100}%)` : "";
  const head = () => {
    c.rect(M, y - 6, W - 2 * M, 20, acc);
    c.text(M + 6, y, "#", 9, true, false, WHITE);
    c.text(66, y, "Description", 9, true, false, WHITE);
    c.text(335, y, "Qty", 9, true, true, WHITE);
    c.text(400, y, "Unit Price", 9, true, true, WHITE);
    c.text(455, y, "Discount", 9, true, true, WHITE);
    c.text(510, y, `Tax${rate}`, 9, true, true, WHITE);
    c.text(W - M - 6, y, "Total", 9, true, true, WHITE);
    y -= 24;
  };
  head();
  inv.lines.forEach((l, i) => {
    const desc = wrap(l.hsn_sac ? `${l.description} (HSN/SAC ${l.hsn_sac})` : l.description, 50);
    if (y - (desc.length - 1) * 11 < M + 40) {
      c.newPage();
      y = H - M;
      head();
    }
    if (i % 2 === 1) c.rect(M, y - desc.length * 11 + 4, W - 2 * M, desc.length * 11 + 5, ZEBRA);
    c.text(M + 6, y, String(i + 1), 9, false, false, INK);
    desc.forEach((d, k) => c.text(66, y - k * 11, d, 9, false, false, INK));
    c.text(335, y, String(l.quantity), 9, false, true, INK);
    c.text(400, y, money(l.unit_minor), 9, false, true, INK);
    c.text(455, y, money(l.discount_minor), 9, false, true, INK);
    c.text(510, y, money(l.tax_minor), 9, false, true, INK);
    c.text(W - M - 6, y, money(l.total_minor), 9, false, true, INK);
    c.rule(y - desc.length * 11 + 4);
    y -= desc.length * 11 + 6;
  });

  const rows: [string, string, boolean?][] = [["Subtotal:", `${cur} ${money(inv.subtotalMinor)}`]];
  if (inv.discountMinor > 0) rows.push(["Discount:", `-${cur} ${money(inv.discountMinor)}`]);
  if (g) {
    if (g.cgst_minor !== undefined) rows.push(["CGST:", `${cur} ${money(g.cgst_minor)}`]);
    if (g.sgst_minor !== undefined) rows.push(["SGST:", `${cur} ${money(g.sgst_minor)}`]);
    if (g.igst_minor !== undefined) rows.push(["IGST:", `${cur} ${money(g.igst_minor)}`]);
  } else if (inv.taxMinor > 0) rows.push(["Tax:", `${cur} ${money(inv.taxMinor)}`]);
  if (g && inv.taxMinor > 0) rows.push(["Total Tax:", `${cur} ${money(inv.taxMinor)}`]);
  if (y - (rows.length + 5) * 15 < M) {
    c.newPage();
    y = H - M;
  }
  const t = totalsLayout(y, rows.length);
  rows.forEach(([label, value], i) => {
    c.text(340, t.rowYs[i] ?? y, label, 9, false, false, INK);
    c.text(W - M - 6, t.rowYs[i] ?? y, value, 9, false, true, INK);
  });
  c.rect(340, t.boxY, W - M - 340, TOTAL_BOX_H, acc);
  c.text(346, t.boxY + 8, "Grand Total:", 11, true, false, WHITE);
  c.text(W - M - 6, t.boxY + 8, `${cur} ${money(inv.totalMinor)}`, 11, true, true, WHITE);
  y = t.boxY;
  y -= 36;
  c.text(M, y, "Notes", 8, true, false, fill);
  c.text(M, y - 12, inv.notes || DEFAULT_NOTE, 8, false, false, MUTED);
  return assemble(c.pages, logo);
}

/** "#rrggbb" to a PDF "r g b" triple; falls back to slate on bad input. */
function hexToRgb(hex?: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? "");
  const n = parseInt(m?.[1] ?? "41507a", 16);
  return [n >> 16, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(" ");
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
  if (buf.subarray(1, 4).toString() === "PNG") return parsePng(buf);
  return null;
}

/**
 * PNG to an embeddable RGB/gray image. 8-bit gray/RGB pass through untouched; alpha, palette,
 * 16-bit and sub-byte images are decoded and re-encoded as 8-bit RGB with alpha flattened onto
 * white. shortcut: Adam7-interlaced PNGs are unsupported (null), add a de-interlacer if seen.
 */
function parsePng(buf: Buffer): PdfImage | null {
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const depth = buf[24] ?? 0;
  const type = buf[25] ?? 0; // 0 gray, 2 RGB, 3 palette, 4 gray+alpha, 6 RGBA
  if (buf[28] !== 0 || !w || !h) return null;
  const idat: Buffer[] = [];
  let plte: Buffer | null = null;
  let trns: Buffer | null = null;
  for (let i = 8; i + 8 <= buf.length;) {
    const len = buf.readUInt32BE(i);
    const kind = buf.subarray(i + 4, i + 8).toString();
    const body = buf.subarray(i + 8, i + 8 + len);
    if (kind === "IDAT") idat.push(body);
    else if (kind === "PLTE") plte = body;
    else if (kind === "tRNS") trns = body;
    i += 12 + len;
  }
  const data = Buffer.concat(idat);
  if ((type === 0 || type === 2) && depth === 8) {
    return {
      w,
      h,
      cs: type === 0 ? "DeviceGray" : "DeviceRGB",
      filter: "FlateDecode",
      data,
      colors: type === 0 ? 1 : 3,
    };
  }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!ch || (type === 3 && !plte) || ![1, 2, 4, 8, 16].includes(depth)) return null;
  // Decompression-bomb guard: a logo never needs more than 4096x4096.
  if (w > 4096 || h > 4096) return null;
  try {
    const bpp = Math.max(1, (ch * depth) >> 3); // bytes per pixel for filtering
    const stride = Math.ceil((w * ch * depth) / 8);
    const raw = inflateSync(data, { maxOutputLength: (stride + 1) * h });
    const px = Buffer.alloc(stride * h);
    for (let r = 0; r < h; r++) {
      const f = raw[r * (stride + 1)] ?? 0;
      for (let x = 0; x < stride; x++) {
        const v = raw[r * (stride + 1) + 1 + x] ?? 0;
        const a = x >= bpp ? (px[r * stride + x - bpp] ?? 0) : 0;
        const b = r ? (px[(r - 1) * stride + x] ?? 0) : 0;
        const c = r && x >= bpp ? (px[(r - 1) * stride + x - bpp] ?? 0) : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        px[r * stride + x] = (v + ([0, a, b, (a + b) >> 1, paeth][f] ?? 0)) & 255;
      }
    }
    // sample n of row r, scaled to 0..255 (raw index for palette)
    const sample = (r: number, n: number): number => {
      if (depth === 8) return px[r * stride + n] ?? 0;
      if (depth === 16) return px[r * stride + n * 2] ?? 0;
      const bit = n * depth;
      const byte = px[r * stride + (bit >> 3)] ?? 0;
      const v = (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
      return type === 3 ? v : Math.round((v * 255) / ((1 << depth) - 1));
    };
    const pal = plte ?? Buffer.alloc(0);
    const out = Buffer.alloc((w * 3 + 1) * h);
    const flat = (c: number, a: number) => Math.round((c * a + 255 * (255 - a)) / 255);
    for (let r = 0; r < h; r++) {
      for (let x = 0; x < w; x++) {
        let rgb: number[];
        let a = 255;
        if (type === 3) {
          const i = sample(r, x);
          rgb = [pal[i * 3] ?? 0, pal[i * 3 + 1] ?? 0, pal[i * 3 + 2] ?? 0];
          a = trns?.[i] ?? 255;
        } else if (type === 0 || type === 4) {
          const g = sample(r, x * ch);
          rgb = [g, g, g];
          if (type === 4) a = sample(r, x * ch + 1);
        } else {
          rgb = [sample(r, x * ch), sample(r, x * ch + 1), sample(r, x * ch + 2)];
          if (type === 6) a = sample(r, x * ch + 3);
        }
        const o = r * (w * 3 + 1) + 1 + x * 3;
        out[o] = flat(rgb[0] ?? 0, a);
        out[o + 1] = flat(rgb[1] ?? 0, a);
        out[o + 2] = flat(rgb[2] ?? 0, a);
      }
    }
    return { w, h, cs: "DeviceRGB", filter: "FlateDecode", data: deflateSync(out), colors: 3 };
  } catch {
    return null;
  }
}

/** Fetches the snapshot logo (4s timeout); any failure or unsupported format yields null. */
export async function fetchLogo(url: string | null | undefined): Promise<PdfImage | null> {
  if (!url) return null;
  try {
    const u = new URL(url, process.env.NEXT_PUBLIC_SITE_URL);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // Server-side fetch: only our own site/media origins, never an arbitrary host.
    const allowed = [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_MEDIA_BASE_URL]
      .filter((o): o is string => Boolean(o))
      .map((o) => new URL(o).origin);
    if (!allowed.includes(u.origin)) return null;
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
