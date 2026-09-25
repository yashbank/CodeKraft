import { describe, expect, it } from "vitest";
import { productFiltersSchema } from "@/modules/search/contracts";

describe("catalog search filters schema", () => {
  it("validates valid filter inputs", () => {
    const valid = productFiltersSchema.safeParse({
      categorySlug: "developer-tools",
      priceMin: 1000,
      priceMax: 5000,
      purchaseModel: "one_time",
      deliveryType: "download",
      techStack: ["React", "Next.js"],
      industry: ["E-commerce"],
      targetAudience: ["Developers"],
    });

    expect(valid.success).toBe(true);
  });

  it("accepts empty or partial filter objects", () => {
    expect(productFiltersSchema.safeParse({}).success).toBe(true);
    expect(productFiltersSchema.safeParse({ priceMin: 500 }).success).toBe(true);
    expect(productFiltersSchema.safeParse({ priceMax: 1000 }).success).toBe(true);
  });

  it("rejects priceMin > priceMax", () => {
    const invalid = productFiltersSchema.safeParse({
      priceMin: 10000,
      priceMax: 5000,
    });

    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.message).toContain("priceMin must not exceed priceMax");
    }
  });

  it("rejects negative prices", () => {
    expect(productFiltersSchema.safeParse({ priceMin: -100 }).success).toBe(false);
    expect(productFiltersSchema.safeParse({ priceMax: -1 }).success).toBe(false);
  });
});
