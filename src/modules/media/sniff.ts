/**
 * Magic-byte sniffing for uploaded files — docs/09 TM-12, docs/06 §3.5, docs/12 §6, SA-13.
 *
 * Checks first bytes against signatures to ensure declared MIME matches real content.
 * Explicitly rejects SVG, HTML, JS, and Executables (PE/ELF/Mach-O).
 */

export interface SniffResult {
  ok: boolean;
  detectedMime: string | null;
  isDangerous: boolean;
  reason?: string;
}

/** Check for dangerous executable or script signatures. */
export function isDangerousContent(buf: Buffer): { dangerous: boolean; reason?: string } {
  if (buf.length >= 2) {
    // Windows PE executable (MZ header)
    if (buf[0] === 0x4d && buf[1] === 0x5a) {
      return { dangerous: true, reason: "executable_pe_detected" };
    }
  }

  if (buf.length >= 4) {
    // Linux ELF binary
    if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) {
      return { dangerous: true, reason: "executable_elf_detected" };
    }
    // Mach-O binary
    const hex4 = buf.subarray(0, 4).toString("hex").toUpperCase();
    if (["FEEDFACE", "CEFAEDFE", "FEEDFACF", "CFFAEDFE", "CAFEBABE"].includes(hex4)) {
      return { dangerous: true, reason: "executable_macho_detected" };
    }
  }

  // HTML / SVG check: convert first 256 bytes to lower-case string
  const prefix = buf.subarray(0, Math.min(buf.length, 512)).toString("utf8").toLowerCase().trim();
  if (
    prefix.startsWith("<!doctype html") ||
    prefix.startsWith("<html") ||
    prefix.startsWith("<script") ||
    prefix.includes("<script") ||
    prefix.startsWith("<svg") ||
    prefix.includes("<svg") ||
    (prefix.startsWith("<?xml") && prefix.includes("<svg"))
  ) {
    return { dangerous: true, reason: "script_or_markup_detected" };
  }

  return { dangerous: false };
}

/** Sniff MIME type from the first bytes of a buffer. */
export function sniffMimeType(buf: Buffer): string | null {
  if (buf.length < 3) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }

  // GIF: GIF87a or GIF89a (47 49 46 38 37 61 or 47 49 46 38 39 61)
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return "image/gif";
  }

  // WebP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }

  // PDF: %PDF- (25 50 44 46 2D)
  if (
    buf.length >= 5 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46 &&
    buf[4] === 0x2d
  ) {
    return "application/pdf";
  }

  // ZIP: PK\x03\x04 or PK\x05\x06 or PK\x07\x08
  if (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
    (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08)
  ) {
    return "application/zip";
  }

  // GZIP: 1F 8B
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    return "application/gzip";
  }

  // 7Z: 37 7A BC AF 27 1C
  if (
    buf.length >= 6 &&
    buf[0] === 0x37 &&
    buf[1] === 0x7a &&
    buf[2] === 0xbc &&
    buf[3] === 0xaf &&
    buf[4] === 0x27 &&
    buf[5] === 0x1c
  ) {
    return "application/x-7z-compressed";
  }

  // MP4 / AVIF: offset 4 is 'ftyp'
  if (
    buf.length >= 12 &&
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  ) {
    const brand = buf.subarray(8, 12).toString("latin1");
    if (brand.startsWith("avi") || brand.startsWith("mif1")) {
      return "image/avif";
    }
    return "video/mp4";
  }

  // WebM: 1A 45 DF A3 (EBML)
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return "video/webm";
  }

  // Plain text / CSV: no null bytes in the first 512 bytes, printable ASCII / UTF-8
  let isText = true;
  const inspectLen = Math.min(buf.length, 512);
  for (let i = 0; i < inspectLen; i++) {
    const byte = buf[i];
    if (byte === 0) {
      isText = false;
      break;
    }
  }
  if (isText) {
    return "text/plain";
  }

  return null;
}

/**
 * Verify that the magic bytes of the file match the expected MIME type,
 * and assert that the file is not dangerous (HTML, SVG, EXE, etc.).
 */
export function verifyMagicBytes(buf: Buffer, expectedMime: string): SniffResult {
  const dangerous = isDangerousContent(buf);
  if (dangerous.dangerous) {
    return {
      ok: false,
      detectedMime: null,
      isDangerous: true,
      reason: dangerous.reason,
    };
  }

  const detected = sniffMimeType(buf);
  const normalizedExpected = expectedMime.toLowerCase().trim();

  // Handle aliases & text families
  if (normalizedExpected === "application/x-zip-compressed" && detected === "application/zip") {
    return { ok: true, detectedMime: detected, isDangerous: false };
  }

  if (normalizedExpected === "text/csv" && detected === "text/plain") {
    return { ok: true, detectedMime: detected, isDangerous: false };
  }

  if (detected === normalizedExpected) {
    return { ok: true, detectedMime: detected, isDangerous: false };
  }

  return {
    ok: false,
    detectedMime: detected,
    isDangerous: false,
    reason: `Declared MIME '${normalizedExpected}' does not match detected MIME '${detected ?? "unknown"}'`,
  };
}
