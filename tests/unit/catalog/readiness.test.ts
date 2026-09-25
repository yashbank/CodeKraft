import { describe, expect, it } from "vitest";
import { submitForApprovalSchema } from "@/modules/catalog/contracts";

describe("catalog readiness & submitForApproval schema (FR-CAT-03, API-CAT-11, P3.9)", () => {
  const validProductId = "11111111-1111-4111-8111-111111111111";

  it("validates submitForApprovalSchema with valid product ID", () => {
    const valid = {
      productId: validProductId,
    };
    const parsed = submitForApprovalSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("accepts valid ISO publishAt timestamp for scheduled publishing", () => {
    const validWithPublishAt = {
      productId: validProductId,
      publishAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const parsed = submitForApprovalSchema.safeParse(validWithPublishAt);
    expect(parsed.success).toBe(true);
  });

  it("rejects non-uuid product ID", () => {
    const invalid = {
      productId: "not-a-uuid",
    };
    expect(submitForApprovalSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects non-ISO publishAt timestamp", () => {
    const invalid = {
      productId: validProductId,
      publishAt: "tomorrow at 5pm",
    };
    expect(submitForApprovalSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects unknown keys due to strictObject", () => {
    const invalid = {
      productId: validProductId,
      extraField: "hack",
    };
    expect(submitForApprovalSchema.safeParse(invalid).success).toBe(false);
  });
});
