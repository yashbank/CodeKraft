/**
 * Magic-byte sniffing for completed uploads (PHASE-03 P3.5, SA-13): the first bytes of the
 * object must agree with the declared MIME before a `media` row exists. Also extracts image
 * dimensions for PNG/GIF/WebP/JPEG headers (docs/05 T-media `width`/`height`).
 */

/** Bytes to fetch for sniffing (tar's `ustar` sits at 257; JPEG SOF markers usually within 64 KB). */
export const SNIFF_BYTES = 65_536;

function startsWith(bytes: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Canonical MIME detected from the leading bytes, or `null` when nothing matches. */
export function sniffMime(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")) {
    return "image/gif";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (brand === "heic" || brand === "heix" || brand === "mif1") return "image/heic";
    return "video/mp4";
  }
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if (
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
  ) {
    return "application/zip";
  }
  if (startsWith(bytes, [0x1f, 0x8b])) return "application/gzip";
  if (startsWith(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return "application/x-7z-compressed";
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  if (bytes.length >= 262 && ascii(bytes, 257, 5) === "ustar") return "application/x-tar";
  return null;
}

/** MIME families whose members sniff to the same canonical value. */
const ACCEPTED_SNIFF: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "image/jpeg": ["image/jpeg"],
  "image/png": ["image/png"],
  "image/webp": ["image/webp"],
  "image/avif": ["image/avif"],
  "image/gif": ["image/gif"],
  "video/mp4": ["video/mp4"],
  "video/webm": ["video/webm"],
  "application/pdf": ["application/pdf"],
  "application/zip": ["application/zip"],
  "application/x-zip-compressed": ["application/zip"],
  "application/gzip": ["application/gzip"],
  "application/x-tar": ["application/x-tar"],
  "application/x-7z-compressed": ["application/x-7z-compressed"],
});

/** Plain text: UTF-8 without NUL bytes, no leading markup (HTML/SVG smuggled as text). */
export function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  for (let i = 0; i < Math.min(bytes.length, 8_192); i++) {
    if (bytes[i] === 0) return false;
  }
  const head = ascii(bytes, 0, Math.min(bytes.length, 16)).replace(/^﻿|^\s+/, "");
  return !head.startsWith("<");
}

/** Does the declared MIME agree with the bytes? Unknown/binary text is rejected (SA-13). */
export function magicMatches(declaredMime: string, bytes: Uint8Array): boolean {
  const declared = declaredMime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (declared === "text/plain" || declared === "text/csv") {
    return sniffMime(bytes) === null && looksLikeText(bytes);
  }
  const accepted = ACCEPTED_SNIFF[declared];
  if (accepted === undefined) return false;
  const sniffed = sniffMime(bytes);
  return sniffed !== null && accepted.includes(sniffed);
}

export interface ImageDimensions {
  width: number;
  height: number;
}

function u16be(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
}
function u16le(b: Uint8Array, o: number): number {
  return (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8);
}
function u32be(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) * 2 ** 24) + ((b[o + 1] ?? 0) << 16) + ((b[o + 2] ?? 0) << 8) + (b[o + 3] ?? 0);
}
function u24le(b: Uint8Array, o: number): number {
  return (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8) | ((b[o + 2] ?? 0) << 16);
}

function jpegDimensions(b: Uint8Array): ImageDimensions | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1] ?? 0;
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = u16be(b, i + 2);
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    }
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

function webpDimensions(b: Uint8Array): ImageDimensions | null {
  if (b.length < 30) return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8X") {
    return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  }
  if (chunk === "VP8 ") {
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const b0 = b[21] ?? 0;
    const b1 = b[22] ?? 0;
    const b2 = b[23] ?? 0;
    const b3 = b[24] ?? 0;
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }
  return null;
}

/** Width/height from the header bytes; `null` when the format is not parsed here (AVIF, video). */
export function imageDimensions(mime: string, b: Uint8Array): ImageDimensions | null {
  switch (mime) {
    case "image/png":
      return b.length >= 24 ? { width: u32be(b, 16), height: u32be(b, 20) } : null;
    case "image/gif":
      return b.length >= 10 ? { width: u16le(b, 6), height: u16le(b, 8) } : null;
    case "image/jpeg":
      return jpegDimensions(b);
    case "image/webp":
      return webpDimensions(b);
    default:
      return null;
  }
}
