import { describe, expect, it } from "vitest";
import { FEATURED_PRODUCTS_MAX } from "@/modules/content/types";
import { setFeaturedProductsSchema } from "@/modules/content/contracts";

describe("Featured products schema and cap (API-CONT-02, P3.11)", () => {
  it("allows up to 8 unique product UUIDs", () => {
    const ids = Array.from(
      { length: FEATURED_PRODUCTS_MAX },
      (_, i) => `11111111-1111-4111-8111-11111111111${i}`,
    );

    const parsed = setFeaturedProductsSchema.safeParse({ productIds: ids });
    expect(parsed.success).toBe(true);
  });

  it("rejects more than 8 featured product UUIDs", () => {
    const ids = Array.from({ length: 9 }, (_, i) => `11111111-1111-4111-8111-11111111111${i}`);

    const parsed = setFeaturedProductsSchema.safeParse({ productIds: ids });
    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate product UUIDs", () => {
    const ids = ["11111111-1111-4111-8111-111111111110", "11111111-1111-4111-8111-111111111110"];

    const parsed = setFeaturedProductsSchema.safeParse({ productIds: ids });
    expect(parsed.success).toBe(false);
  });
});
