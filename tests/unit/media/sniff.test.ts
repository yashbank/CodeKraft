// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isDangerousContent, sniffMimeType, verifyMagicBytes } from "@/modules/media/sniff";

describe("magic-byte sniffing (docs/09 TM-12, SA-13, PHASE-03 P3.5)", () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const pdfHeader = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj");
  const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
  const webpHeader = Buffer.from("RIFF\x24\x00\x00\x00WEBPVP8 ");
  const gifHeader = Buffer.from("GIF89a\x01\x00\x01\x00");

  it("accurately detects standard file types by magic bytes", () => {
    expect(sniffMimeType(pngHeader)).toBe("image/png");
    expect(sniffMimeType(jpegHeader)).toBe("image/jpeg");
    expect(sniffMimeType(pdfHeader)).toBe("application/pdf");
    expect(sniffMimeType(zipHeader)).toBe("application/zip");
    expect(sniffMimeType(webpHeader)).toBe("image/webp");
    expect(sniffMimeType(gifHeader)).toBe("image/gif");
  });

  it("verifies matching MIME and magic bytes successfully", () => {
    const pngResult = verifyMagicBytes(pngHeader, "image/png");
    expect(pngResult.ok).toBe(true);
    expect(pngResult.isDangerous).toBe(false);

    const pdfResult = verifyMagicBytes(pdfHeader, "application/pdf");
    expect(pdfResult.ok).toBe(true);

    const zipResult = verifyMagicBytes(zipHeader, "application/zip");
    expect(zipResult.ok).toBe(true);
  });

  it("rejects MIME and magic byte mismatches", () => {
    // Declared JPEG but uploaded a PDF
    const result = verifyMagicBytes(pdfHeader, "image/jpeg");
    expect(result.ok).toBe(false);
    expect(result.detectedMime).toBe("application/pdf");
    expect(result.reason).toMatch(/does not match/i);

    // Declared PNG but uploaded a ZIP
    const result2 = verifyMagicBytes(zipHeader, "image/png");
    expect(result2.ok).toBe(false);
    expect(result2.detectedMime).toBe("application/zip");
  });

  it("identifies and blocks dangerous executable binaries (SA-13)", () => {
    // Windows PE executable (MZ header)
    const peBinary = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    const peResult = verifyMagicBytes(peBinary, "application/octet-stream");
    expect(peResult.ok).toBe(false);
    expect(peResult.isDangerous).toBe(true);
    expect(peResult.reason).toBe("executable_pe_detected");

    // Linux ELF binary
    const elfBinary = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    const elfResult = verifyMagicBytes(elfBinary, "application/octet-stream");
    expect(elfResult.ok).toBe(false);
    expect(elfResult.isDangerous).toBe(true);
    expect(elfResult.reason).toBe("executable_elf_detected");
  });

  it("identifies and blocks HTML, SVG, and script markup (SA-13)", () => {
    const htmlPayload = Buffer.from("<!DOCTYPE html><html><body><h1>XSS</h1></body></html>");
    expect(isDangerousContent(htmlPayload).dangerous).toBe(true);

    const svgPayload = Buffer.from(
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    expect(isDangerousContent(svgPayload).dangerous).toBe(true);

    const rawSvg = Buffer.from(
      '<svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>',
    );
    expect(isDangerousContent(rawSvg).dangerous).toBe(true);

    // Should be rejected by verifyMagicBytes even if declared as text or image
    const res = verifyMagicBytes(svgPayload, "text/plain");
    expect(res.ok).toBe(false);
    expect(res.isDangerous).toBe(true);
  });
});
