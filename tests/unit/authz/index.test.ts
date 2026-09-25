import { describe, expect, it } from "vitest";
import * as authz from "@/lib/authz";

describe("@/lib/authz barrel", () => {
  it("re-exports permissions, context, assert and scope", () => {
    expect(authz.PERMISSIONS.length).toBeGreaterThan(0);
    expect(typeof authz.buildContext).toBe("function");
    expect(typeof authz.assertPermission).toBe("function");
    expect(typeof authz.productScope).toBe("function");
  });
});
