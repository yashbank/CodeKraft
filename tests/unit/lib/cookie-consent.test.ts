import { describe, expect, it } from "vitest";

import { NOTICE_SEEN, shouldShowNotice } from "@/lib/cookie-consent";

describe("cookie notice gating (P14-12b)", () => {
  it("shows until dismissed, then never again", () => {
    expect(shouldShowNotice(null)).toBe(true);
    expect(shouldShowNotice("")).toBe(true);
    expect(shouldShowNotice(NOTICE_SEEN)).toBe(false);
  });
});
