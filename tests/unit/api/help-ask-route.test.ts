// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolve = vi.fn();
const answer = vi.fn();
const partner = vi.fn();
vi.mock("@/lib/authz/resolve-route-context", () => ({
  resolveRouteContext: (...a: unknown[]) => resolve(...a),
}));
vi.mock("@/modules/help/answer", () => ({
  MAX_QUERY_CHARS: 300,
  answerQuestion: (...a: unknown[]) => answer(...a),
}));
vi.mock("@/modules/help/config", () => ({
  getHelpConfig: async () => ({ enabled: true, hindi: true, ai: true }),
}));
vi.mock("@/lib/rate-limit", () => ({
  MINUTE_MS: 60_000,
  rateLimit: async () => ({ allowed: true, resetAt: 0 }),
}));
vi.mock("@/modules/help/role", async (orig) => ({
  ...(await orig<typeof import("@/modules/help/role")>()),
  findPartnerId: (...a: unknown[]) => partner(...a),
}));

import { POST } from "@/app/api/help/ask/route";

const ask = () =>
  POST(new Request("http://localhost/api/help/ask", { method: "POST", body: '{"query":"hi"}' }));

describe("POST /api/help/ask role gate", () => {
  beforeEach(() => {
    resolve.mockReset();
    answer.mockReset().mockResolvedValue({ answer: "ok", sources: [], mode: "guide" });
    partner.mockReset().mockResolvedValue(undefined);
  });

  it("anonymous: 404 off, no answer work", async () => {
    resolve.mockResolvedValue({ roles: [], userId: undefined });
    const res = await ask();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ mode: "off" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("customer: 404 off", async () => {
    resolve.mockResolvedValue({ roles: ["customer"], userId: "u1" });
    const res = await ask();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ mode: "off" });
    expect(answer).not.toHaveBeenCalled();
  });

  it.each(["staff", "admin", "super_admin"])("%s: answered with that role", async (role) => {
    resolve.mockResolvedValue({ roles: [role], userId: "u1" });
    const res = await ask();
    expect(res.status).toBe(200);
    expect(answer).toHaveBeenCalledWith(expect.objectContaining({ role }));
  });

  it("partner (customer role + partners row): answered as partner", async () => {
    resolve.mockResolvedValue({ roles: ["customer"], userId: "u2" });
    partner.mockResolvedValue("p1");
    const res = await ask();
    expect(res.status).toBe(200);
    expect(answer).toHaveBeenCalledWith(expect.objectContaining({ role: "partner" }));
  });
});
