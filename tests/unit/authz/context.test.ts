import { describe, expect, it } from "vitest";
import {
  anonymousContext,
  buildContext,
  isAuthenticated,
  requireContext,
} from "@/lib/authz/context";
import { AppError, ErrorCode } from "@/lib/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("buildContext", () => {
  it("derives permissions from roles loaded per request and keeps optional fields off when empty", () => {
    const ctx = buildContext({
      user: { id: "u1" },
      session: { id: "s1" },
      roles: ["customer", "customer", "bogus"],
      partnerId: null,
      ip: "",
      userAgent: undefined,
    });
    expect(ctx.userId).toBe("u1");
    expect(ctx.sessionId).toBe("s1");
    expect(ctx.roles).toEqual(["customer"]);
    expect(ctx.permissions.has("commerce.self")).toBe(true);
    expect(ctx.permissions.has("catalog.read")).toBe(false);
    expect("partnerId" in ctx).toBe(false);
    expect("ip" in ctx).toBe(false);
    expect("userAgent" in ctx).toBe(false);
    expect(ctx.requestId).toMatch(UUID);
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it("keeps partnerId, ip, userAgent and a supplied requestId", () => {
    const ctx = buildContext({
      user: { id: "u2" },
      session: { id: "s2" },
      roles: ["admin"],
      partnerId: "p2",
      ip: "203.0.113.9",
      userAgent: "vitest",
      requestId: "req-1",
    });
    expect(ctx).toMatchObject({
      partnerId: "p2",
      ip: "203.0.113.9",
      userAgent: "vitest",
      requestId: "req-1",
    });
    expect(ctx.permissions.has("catalog.write")).toBe(true);
  });

  it("unions permissions for multi-role users", () => {
    const ctx = buildContext({
      user: { id: "u3" },
      session: { id: "s3" },
      roles: ["staff", "admin"],
    });
    expect(ctx.roles).toEqual(["staff", "admin"]);
    expect(ctx.permissions.has("approvals.decide")).toBe(true);
  });
});

describe("anonymousContext", () => {
  it("has no user, roles or permissions and generates a requestId", () => {
    const ctx = anonymousContext();
    expect(ctx.userId).toBeNull();
    expect(ctx.roles).toEqual([]);
    expect(ctx.permissions.size).toBe(0);
    expect(ctx.requestId).toMatch(UUID);
    expect("ip" in ctx).toBe(false);
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it("carries ip, userAgent and requestId when given", () => {
    const ctx = anonymousContext({ ip: "198.51.100.1", userAgent: "ua", requestId: "r" });
    expect(ctx).toMatchObject({ ip: "198.51.100.1", userAgent: "ua", requestId: "r" });
  });
});

describe("requireContext", () => {
  it("returns the authenticated context unchanged", () => {
    const ctx = buildContext({ user: { id: "u" }, session: { id: "s" }, roles: [] });
    expect(isAuthenticated(ctx)).toBe(true);
    expect(requireContext(ctx)).toBe(ctx);
  });

  it("throws UNAUTHENTICATED for anonymous", () => {
    const ctx = anonymousContext();
    expect(isAuthenticated(ctx)).toBe(false);
    expect(() => requireContext(ctx)).toThrowError(AppError);
    try {
      requireContext(ctx);
    } catch (err) {
      expect((err as AppError).code).toBe(ErrorCode.UNAUTHENTICATED);
    }
  });
});
