import { describe, expect, it } from "vitest";
import { updateLegalPageSchema, publishLegalPageSchema } from "@/modules/content/contracts";
import { LEGAL_PAGE_KEYS } from "@/modules/content/types";

describe("Legal page schemas (API-CONT-08, P3.11)", () => {
  it("validates legal page keys", () => {
    for (const key of LEGAL_PAGE_KEYS) {
      expect(publishLegalPageSchema.safeParse({ key }).success).toBe(true);
      expect(
        updateLegalPageSchema.safeParse({
          key,
          title: "Legal Terms",
          bodyJson: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Terms content" }] }],
          },
        }).success,
      ).toBe(true);
    }

    expect(publishLegalPageSchema.safeParse({ key: "invalid-key" }).success).toBe(false);
  });
});
