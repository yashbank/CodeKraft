import { beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  value: {
    userId: null as string | null,
    roles: [] as string[],
    ip: "9.9.9.9",
    partnerId: undefined as string | undefined,
  },
}));
const config = vi.hoisted(() => ({ value: { enabled: true, hindi: false, ai: true } }));
const answer = vi.hoisted(() => vi.fn());
const limit = vi.hoisted(() => ({ allowed: true }));

vi.mock("@/lib/authz/resolve-route-context", () => ({
  resolveRouteContext: async () => ctx.value,
}));
vi.mock("@/modules/help/config", () => ({ getHelpConfig: async () => config.value }));
vi.mock("@/modules/help/answer", () => ({ answerQuestion: answer, MAX_QUERY_CHARS: 300 }));
vi.mock("@/lib/rate-limit", () => ({
  MINUTE_MS: 60_000,
  rateLimit: async () => ({ allowed: limit.allowed, remaining: 0, resetAt: Date.now() + 1000 }),
}));

import { POST } from "@/app/api/help/ask/route";

const post = (body: unknown, raw = false) =>
  POST(
    new Request("http://x/api/help/ask", {
      method: "POST",
      body: raw ? (body as string) : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  ctx.value = { userId: null, roles: [], ip: "9.9.9.9", partnerId: undefined };
  config.value = { enabled: true, hindi: false, ai: true };
  limit.allowed = true;
  answer.mockReset().mockResolvedValue({ answer: "ok", sources: [], mode: "guide" });
});

describe("POST /api/help/ask", () => {
  it("anonymous gets customer-level answer", async () => {
    const res = await post({ query: "reset password" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ answer: "ok", sources: [], mode: "guide" });
    expect(answer.mock.calls[0]![0]).toMatchObject({
      role: "customer",
      userId: null,
      ip: "9.9.9.9",
      locale: "en",
    });
  });

  it("maps highest role from session, partner from partnerId", async () => {
    ctx.value = { userId: "u1", roles: ["staff", "admin"], ip: "1.1.1.1", partnerId: undefined };
    await post({ query: "q" });
    expect(answer.mock.calls[0]![0]).toMatchObject({ role: "admin", userId: "u1" });
    ctx.value = { userId: "u2", roles: ["customer"], ip: "1.1.1.1", partnerId: "p1" };
    await post({ query: "q" });
    expect(answer.mock.calls[1]![0].role).toBe("partner");
  });

  it("returns 404 mode off when disabled", async () => {
    config.value.enabled = false;
    const res = await post({ query: "q" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ mode: "off" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("validates body", async () => {
    expect((await post("not json", true)).status).toBe(400);
    expect((await post({ query: "" })).status).toBe(400);
    expect((await post({ query: "x".repeat(301) })).status).toBe(400);
    expect((await post({ query: "q", extra: 1 })).status).toBe(400);
    expect((await post({ query: 5 })).status).toBe(400);
    expect((await post([])).status).toBe(400);
    expect(answer).not.toHaveBeenCalled();
  });

  it("caps body at 2 KB", async () => {
    expect((await post({ query: "q", pad: "x".repeat(3000) })).status).toBe(413);
  });

  it("allows hi only when config.hindi", async () => {
    expect((await post({ query: "q", locale: "hi" })).status).toBe(400);
    config.value.hindi = true;
    expect((await post({ query: "q", locale: "hi" })).status).toBe(200);
  });

  it("429 when flood limit hit", async () => {
    limit.allowed = false;
    const res = await post({ query: "q" });
    expect(res.status).toBe(429);
    expect(answer).not.toHaveBeenCalled();
  });

  it("500 hides internals", async () => {
    answer.mockRejectedValue(new Error("secret db url"));
    const res = await post({ query: "q" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
