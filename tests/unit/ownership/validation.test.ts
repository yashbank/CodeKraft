import { describe, expect, it } from "vitest";
import { proposeOwnershipSchema, sumsToTotal } from "@/modules/ownership/contracts";

describe("ownership schema and helper validation (API-CAT-16, BR-06/07, P3.8)", () => {
  const validProductId = "11111111-1111-4111-8111-111111111111";
  const partner1 = "22222222-2222-4222-8222-222222222222";
  const partner2 = "33333333-3333-4333-8333-333333333333";

  it("accepts valid proposeOwnership input", () => {
    const input = {
      productId: validProductId,
      companyCutBps: 2000,
      lines: [
        { partnerId: partner1, shareBps: 5000 },
        { partnerId: partner2, shareBps: 3000 },
      ],
      effectiveFrom: new Date().toISOString(),
    };
    const parsed = proposeOwnershipSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it("rejects non-uuid product or partner IDs", () => {
    const invalid = {
      productId: "invalid-uuid",
      companyCutBps: 2000,
      lines: [{ partnerId: partner1, shareBps: 8000 }],
    };
    expect(proposeOwnershipSchema.safeParse(invalid).success).toBe(false);

    const invalidPartner = {
      productId: validProductId,
      companyCutBps: 2000,
      lines: [{ partnerId: "bad-partner", shareBps: 8000 }],
    };
    expect(proposeOwnershipSchema.safeParse(invalidPartner).success).toBe(false);
  });

  it("rejects duplicate partners in lines", () => {
    const duplicate = {
      productId: validProductId,
      companyCutBps: 2000,
      lines: [
        { partnerId: partner1, shareBps: 4000 },
        { partnerId: partner1, shareBps: 4000 },
      ],
    };
    const result = proposeOwnershipSchema.safeParse(duplicate);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/each partner may appear once/i);
    }
  });

  it("rejects empty lines array or > 20 lines", () => {
    const emptyLines = {
      productId: validProductId,
      companyCutBps: 10000,
      lines: [],
    };
    expect(proposeOwnershipSchema.safeParse(emptyLines).success).toBe(false);

    const tooManyLines = {
      productId: validProductId,
      companyCutBps: 0,
      lines: Array.from({ length: 21 }, (_, i) => ({
        partnerId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        shareBps: 100,
      })),
    };
    expect(proposeOwnershipSchema.safeParse(tooManyLines).success).toBe(false);
  });

  it("rejects negative shareBps or companyCutBps", () => {
    expect(
      proposeOwnershipSchema.safeParse({
        productId: validProductId,
        companyCutBps: -500,
        lines: [{ partnerId: partner1, shareBps: 10500 }],
      }).success,
    ).toBe(false);

    expect(
      proposeOwnershipSchema.safeParse({
        productId: validProductId,
        companyCutBps: 0,
        lines: [{ partnerId: partner1, shareBps: 0 }],
      }).success,
    ).toBe(false);
  });

  it("sumsToTotal correctly verifies 10000 bps total", () => {
    expect(sumsToTotal([{ shareBps: 2000 }, { shareBps: 5000 }, { shareBps: 3000 }])).toBe(true);

    expect(sumsToTotal([{ shareBps: 5000 }, { shareBps: 4000 }])).toBe(false);
  });
});
