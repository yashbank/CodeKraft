// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const submit = vi.fn();
vi.mock("@/modules/leads/public-submit", () => ({
  submitPublicLead: (...a: unknown[]) => submit(...a),
}));

import { POST } from "@/app/api/leads/route";

const post = (body: string, headers: Record<string, string> = {}) =>
  POST(new NextRequest("http://localhost/api/leads", { method: "POST", body, headers }));

describe("POST /api/leads error handling", () => {
  beforeEach(() => {
    submit.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it.each(["{not json", "", "null", "42", '"str"', "[1,2]"])("400 generic for %j", async (raw) => {
    const res = await post(raw);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "Invalid request" });
    expect(submit).not.toHaveBeenCalled();
  });

  it("413 when the body exceeds 64 KB (real size, or declared length)", async () => {
    const big = JSON.stringify({ message: "x".repeat(70_000) });
    expect((await post(big)).status).toBe(413);
    expect((await post("{}", { "content-length": "70000" })).status).toBe(413);
    expect(submit).not.toHaveBeenCalled();
  });

  it("500 generic, no internals, for unexpected errors", async () => {
    submit.mockRejectedValue(new Error("Cannot read properties of null (reading 'source')"));
    const res = await post("{}");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("Cannot read");
    expect(console.error).toHaveBeenCalled();
  });

  it("still maps service results (ok, 429, 400)", async () => {
    submit.mockResolvedValueOnce({ ok: true, data: { leadId: "abcdef1234567890" } });
    expect((await (await post("{}")).json()).reference).toBe("CK-L-ABCDEF12");
    submit.mockResolvedValueOnce({ ok: false, error: { code: "RATE_LIMITED", message: "slow" } });
    expect((await post("{}")).status).toBe(429);
    submit.mockResolvedValueOnce({ ok: false, error: { code: "VALIDATION", message: "bad" } });
    expect((await post("{}")).status).toBe(400);
  });
});
