import { describe, expect, it } from "vitest";
import { formatCreditNoteNo, formatInvoiceNo, formatOrderNo, newId, randomToken } from "@/lib/ids";

describe("public number formats (docs/06 §1.9, BR-16)", () => {
  it("formats order numbers", () => {
    expect(formatOrderNo(1)).toBe("CK-ORD-000001");
    expect(formatOrderNo(999_999)).toBe("CK-ORD-999999");
    expect(formatOrderNo(1_000_000)).toBe("CK-ORD-1000000");
    expect(() => formatOrderNo(0)).toThrow(/order sequence/);
    expect(() => formatOrderNo(1.5)).toThrow(RangeError);
  });

  it("formats invoice numbers per financial year", () => {
    expect(formatInvoiceNo("2026-27", 1)).toBe("CK/2026-27/0001");
    expect(formatInvoiceNo("2026-27", 12_345)).toBe("CK/2026-27/12345");
    expect(() => formatInvoiceNo("2026", 1)).toThrow(/financial year/);
    expect(() => formatInvoiceNo("2026-27", -1)).toThrow(/invoice sequence/);
  });

  it("formats credit-note numbers", () => {
    expect(formatCreditNoteNo("2026-27", 1)).toBe("CK/CN/2026-27/0001");
    expect(() => formatCreditNoteNo("26-27", 1)).toThrow(/financial year/);
    expect(() => formatCreditNoteNo("2026-27", 0)).toThrow(/credit note sequence/);
  });
});

describe("newId / randomToken", () => {
  it("newId is a v4 uuid", () => {
    expect(newId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(newId()).not.toBe(newId());
  });

  it("randomToken is unpadded base64url of the requested size", () => {
    const t = randomToken();
    expect(t).toHaveLength(43); // 32 bytes → ceil(32 × 4 / 3) without padding
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(randomToken(16)).toHaveLength(22);
    expect(randomToken(48)).toHaveLength(64);
    expect(randomToken()).not.toBe(randomToken());
    expect(() => randomToken(8)).toThrow(/at least 16 bytes/);
    expect(() => randomToken(16.5)).toThrow(RangeError);
  });
});
