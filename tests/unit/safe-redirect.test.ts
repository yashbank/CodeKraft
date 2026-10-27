import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "../../src/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("accepts same-origin relative paths with query", () => {
    expect(safeRedirectPath("/products/x?offering=1", "/account")).toBe("/products/x?offering=1");
  });
  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "",
    null,
    "/a\nb",
    "/%2F%2Fevil.com",
    "/%5Cevil.com",
    "/\\/evil.com",
    "/\t/evil.com",
    " //evil.com",
    "JaVaScRiPt:alert(1)",
    "data:text/html,x",
  ])("rejects %s", (v) => expect(safeRedirectPath(v, "/account")).toBe("/account"));
});
