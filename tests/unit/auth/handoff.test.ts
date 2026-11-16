import { describe, expect, it } from "vitest";

import {
  HANDOFF_TOKEN_TTL_MINUTES,
  applyHandoffHeaders,
  buildHandoffUrl,
  isHandoffApiPath,
  parseHandoffFragment,
} from "@/modules/auth/handoff";

describe("handoff URL", () => {
  it("puts the token in the fragment, never in the query string", () => {
    const url = buildHandoffUrl("http://admin.localhost:3000", "tok/+=", "/dashboard");
    const u = new URL(url);
    expect(u.search).toBe("");
    expect(u.pathname).toBe("/auth/handoff");
    expect(u.hash).toContain("token=");
    expect(parseHandoffFragment(u.hash)).toEqual({ token: "tok/+=", next: "/dashboard" });
  });

  it("falls back to /dashboard for unsafe next values", () => {
    for (const bad of ["//evil.test", "https://evil.test", "/\\evil", "/%2F%2Fevil"]) {
      const { next } = parseHandoffFragment(
        new URL(buildHandoffUrl("http://a.test", "t", bad)).hash,
      );
      expect(next).toBe("/dashboard");
    }
    expect(parseHandoffFragment("#token=t&next=//evil.test").next).toBe("/dashboard");
  });

  it("returns null token for empty or missing fragments", () => {
    expect(parseHandoffFragment("").token).toBeNull();
    expect(parseHandoffFragment("#next=/x").token).toBeNull();
  });

  it("ttl is at most 60 seconds", () => {
    expect(HANDOFF_TOKEN_TTL_MINUTES * 60).toBeLessThanOrEqual(60);
  });
});

describe("handoff headers", () => {
  it("sets no-referrer and no-store", () => {
    const h = new Headers();
    applyHandoffHeaders(h);
    expect(h.get("Referrer-Policy")).toBe("no-referrer");
    expect(h.get("Cache-Control")).toContain("no-store");
  });
  it("matches only the one-time-token api paths", () => {
    expect(isHandoffApiPath("/api/auth/one-time-token/verify")).toBe(true);
    expect(isHandoffApiPath("/api/auth/one-time-token/generate")).toBe(true);
    expect(isHandoffApiPath("/api/auth/sign-in/email")).toBe(false);
  });
});
