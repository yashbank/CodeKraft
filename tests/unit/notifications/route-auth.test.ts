// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/lib/authz/resolve-route-context", () => ({
  resolveRouteContext: async () => ({ kind: "anonymous" }),
}));

describe("GET /api/notifications", () => {
  it("returns 401 UNAUTHENTICATED when anonymous", async () => {
    const { GET } = await import("../../../src/app/api/notifications/route");
    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });
});
