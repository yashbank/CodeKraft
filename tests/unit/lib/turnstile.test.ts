import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyTurnstile } from "@/lib/turnstile";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("verifyTurnstile", () => {
  it("rejects bypass tokens in production without secret (fail closed)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("TURNSTILE_SECRET", "");
    await expect(verifyTurnstile("mock-turnstile-token")).rejects.toThrow();
  });

  it("does not honor mock/test tokens or secret=test in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test");
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success: false }) });
    vi.stubGlobal("fetch", fetchMock);
    for (const t of ["mock-turnstile-token", "test-valid-1"]) {
      expect(await verifyTurnstile(t)).toEqual({ success: false, error: "CAPTCHA_FAILED" });
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to TURNSTILE_SECRET when TURNSTILE_SECRET_KEY is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET", "real-secret");
    delete process.env.TURNSTILE_SECRET_KEY;
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTurnstile("real-token")).toEqual({ success: true });
    expect((fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams).get("secret")).toBe(
      "real-secret",
    );
  });

  it("still accepts the mock token outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await verifyTurnstile("mock-turnstile-token")).toEqual({ success: true });
  });
});
