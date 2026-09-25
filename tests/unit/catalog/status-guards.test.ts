import { describe, expect, it } from "vitest";
import { SUBMITTABLE_STATUSES } from "@/modules/catalog/contracts";
import { PRODUCT_STATUSES, type ProductStatus } from "@/modules/catalog/types";

describe("catalog status guards", () => {
  it("only allows submitForApproval from draft and unpublished statuses", () => {
    expect(SUBMITTABLE_STATUSES).toEqual(["draft", "unpublished"]);
    expect(SUBMITTABLE_STATUSES.includes("draft")).toBe(true);
    expect(SUBMITTABLE_STATUSES.includes("unpublished")).toBe(true);
    expect(SUBMITTABLE_STATUSES.includes("published" as ProductStatus)).toBe(false);
    expect(SUBMITTABLE_STATUSES.includes("pending_approval" as ProductStatus)).toBe(false);
    expect(SUBMITTABLE_STATUSES.includes("scheduled" as ProductStatus)).toBe(false);
    expect(SUBMITTABLE_STATUSES.includes("archived" as ProductStatus)).toBe(false);
  });

  it("contains all 6 valid product statuses", () => {
    expect(PRODUCT_STATUSES).toEqual([
      "draft",
      "pending_approval",
      "scheduled",
      "published",
      "unpublished",
      "archived",
    ]);
  });
});
