// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

process.env.ADMIN_HOST = "admin.localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.APP_ENV = "local";

let middleware: typeof import("../../src/middleware").middleware;
beforeAll(async () => {
  ({ middleware } = await import("../../src/middleware"));
});

const req = (url: string, host: string) => new NextRequest(url, { headers: { host } });

describe("middleware host matrix (docs/04 §8, docs/09 §3.5)", () => {
  it("rewrites admin host paths under /admin and marks noindex", () => {
    const res = middleware(req("http://admin.localhost:3000/orders", "admin.localhost:3000"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/admin/orders");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    const root = middleware(req("http://admin.localhost:3000/", "admin.localhost:3000"));
    expect(root.headers.get("x-middleware-rewrite")).toContain("/admin");
  });
  it("leaves /api/* untouched on the admin host", () => {
    const res = middleware(
      req("http://admin.localhost:3000/api/auth/get-session", "admin.localhost:3000"),
    );
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });
  it("serves /auth/* unrewritten on the admin host (shared sign-in screens)", () => {
    const res = middleware(req("http://admin.localhost:3000/auth/login", "admin.localhost:3000"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
  it("hides /admin on the public host", () => {
    const res = middleware(req("http://localhost:3000/admin/orders", "localhost:3000"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/__404");
  });
  it("does not treat a prefixed host as admin (exact match only)", () => {
    const res = middleware(
      req("http://admin.localhost.evil.com:3000/", "admin.localhost.evil.com:3000"),
    );
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });
  it("sets a nonce and a report-only CSP on every response", () => {
    const res = middleware(req("http://localhost:3000/", "localhost:3000"));
    const nonce = res.headers.get("x-nonce");
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    expect(res.headers.get("Content-Security-Policy-Report-Only")).toContain(`'nonce-${nonce}'`);
  });
});
