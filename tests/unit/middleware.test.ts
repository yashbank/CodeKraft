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

const HDR = "Content-Security-Policy-Report-Only";
const req = (url: string, host: string) => new NextRequest(url, { headers: { host } });

describe("middleware host matrix (docs/04 §8, docs/09 §3.5)", () => {
  it("rewrites admin host paths under /admin and marks noindex", async () => {
    const res = await middleware(req("http://admin.localhost:3000/orders", "admin.localhost:3000"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/admin/orders");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    const root = await middleware(req("http://admin.localhost:3000/", "admin.localhost:3000"));
    expect(root.headers.get("x-middleware-rewrite")).toContain("/admin");
  });
  it("leaves /api/* untouched on the admin host", async () => {
    const res = await middleware(
      req("http://admin.localhost:3000/api/auth/get-session", "admin.localhost:3000"),
    );
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });
  it("serves /auth/* unrewritten on the admin host (shared sign-in screens)", async () => {
    const res = await middleware(
      req("http://admin.localhost:3000/auth/login", "admin.localhost:3000"),
    );
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
  it("forwards the original path+search for login redirects", async () => {
    const res = await middleware(
      req("http://admin.localhost:3000/orders?page=2", "admin.localhost:3000"),
    );
    expect(res.headers.get("x-middleware-request-x-request-path")).toBe("/orders?page=2");
  });
  it("hides /admin on the public host", async () => {
    const res = await middleware(req("http://localhost:3000/admin/orders", "localhost:3000"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/__404");
  });
  it("does not treat a prefixed host as admin (exact match only)", async () => {
    const res = await middleware(
      req("http://admin.localhost.evil.com:3000/", "admin.localhost.evil.com:3000"),
    );
    expect(res.headers.get("x-middleware-rewrite") ?? "").not.toMatch(/\/admin(\/|$)/);
  });
  it("sets a nonce and a report-only CSP on every response", async () => {
    const res = await middleware(req("http://localhost:3000/", "localhost:3000"));
    const nonce = res.headers.get("x-nonce");
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    expect(res.headers.get(HDR)).toContain(`'nonce-${nonce}'`);
  });
  it("hash allow-lists the root layout's inline theme script (BUG-028)", async () => {
    const res = await middleware(req("http://localhost:3000/", "localhost:3000"));
    expect(res.headers.get(HDR)).toMatch(/'sha256-[A-Za-z0-9+/=]{20,}'/);
  });
  it("allows Cloudflare Turnstile in script/frame/connect-src", async () => {
    const res = await middleware(req("http://localhost:3000/", "localhost:3000"));
    const csp = res.headers.get(HDR) ?? "";
    for (const d of ["script-src", "frame-src", "connect-src"]) {
      const dir = csp.split("; ").find((x) => x.startsWith(d)) ?? "";
      expect(dir).toContain("https://challenges.cloudflare.com");
    }
  });
  it("enforces with CSP_MODE=enforce and drops unsafe-eval / blanket https:", async () => {
    const prev = { a: process.env.APP_ENV, n: process.env.NODE_ENV, c: process.env.CSP_MODE };
    process.env.APP_ENV = "production";
    process.env.CSP_MODE = "enforce";
    (process.env as Record<string, string>).NODE_ENV = "production";
    try {
      const res = await middleware(req("http://localhost:3000/", "localhost:3000"));
      expect(res.headers.get(HDR)).toBeNull();
      const csp = res.headers.get("Content-Security-Policy") ?? "";
      const script = csp.split("; ").find((x) => x.startsWith("script-src")) ?? "";
      expect(script).toContain("'strict-dynamic'");
      expect(script).not.toContain("unsafe-eval");
      expect(script).not.toMatch(/ https: /);
      expect(script).toContain("https://checkout.razorpay.com");
      for (const d of [
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "object-src 'none'",
        "upgrade-insecure-requests",
        "report-uri /api/csp-report",
      ])
        expect(csp).toContain(d);
      expect(csp).toMatch(/form-action 'self'/);
      expect(csp).not.toMatch(/(img|connect)-src[^;]* https:(;| )/);
      expect(res.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups");
      expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
      expect(res.headers.get("Permissions-Policy")).toContain("razorpay.com");
      // CSP_MODE=report rolls back without code changes
      process.env.CSP_MODE = "report";
      const rb = await middleware(req("http://localhost:3000/", "localhost:3000"));
      expect(rb.headers.get(HDR)).toContain("script-src");
      // R8-12: ignored in report-only and logs a console error on every page.
      expect(rb.headers.get(HDR)).not.toContain("upgrade-insecure-requests");
      expect(rb.headers.get("Content-Security-Policy")).toBeNull();
    } finally {
      process.env.APP_ENV = prev.a;
      (process.env as Record<string, string | undefined>).NODE_ENV = prev.n;
      if (prev.c === undefined) delete process.env.CSP_MODE;
      else process.env.CSP_MODE = prev.c;
    }
  });
});

describe("PDF preview framing (P2-04)", () => {
  it("allows same-origin framing only for the product-media route", async () => {
    const pdf = await middleware(
      req("http://localhost:3000/api/files/product-media/abc", "localhost:3000"),
    );
    expect(pdf.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(pdf.headers.get(HDR)).toContain("frame-ancestors 'self'");
    const other = await middleware(req("http://localhost:3000/", "localhost:3000"));
    expect(other.headers.get("X-Frame-Options")).toBe("DENY");
    expect(other.headers.get(HDR)).toContain("frame-ancestors 'none'");
  });
});

describe("ISR twins for anonymous price pages (P15-02)", () => {
  const rewrite = async (url: string, cookie?: string, method = "GET") =>
    (
      await middleware(
        new NextRequest(url, {
          method,
          headers: { host: "localhost:3000", ...(cookie ? { cookie } : {}) },
        }),
      )
    ).headers.get("x-middleware-rewrite");

  it("rewrites /, /products and /products/[slug] to /ssg for visitors with no cookies", async () => {
    expect(await rewrite("http://localhost:3000/")).toBe("http://localhost:3000/ssg");
    expect(await rewrite("http://localhost:3000/products")).toBe(
      "http://localhost:3000/ssg/products",
    );
    expect(await rewrite("http://localhost:3000/products/fitdesk-pro?utm=x")).toBe(
      "http://localhost:3000/ssg/products/fitdesk-pro?utm=x",
    );
  });

  it("keeps the dynamic route for a currency cookie, a session cookie, search or non-GET", async () => {
    expect(await rewrite("http://localhost:3000/", "ck_currency=USD")).toBeNull();
    expect(await rewrite("http://localhost:3000/products", "ck.session_token=abc")).toBeNull();
    expect(
      await rewrite("http://localhost:3000/products", "__Secure-ck.session_token=abc"),
    ).toBeNull();
    expect(await rewrite("http://localhost:3000/products?q=crm")).toBeNull();
    expect(await rewrite("http://localhost:3000/", undefined, "POST")).toBeNull();
  });

  it("leaves other pages alone and hides the twins from direct requests", async () => {
    expect(await rewrite("http://localhost:3000/blog")).toBeNull();
    expect(await rewrite("http://localhost:3000/products/a/opengraph-image")).toBeNull();
    expect(await rewrite("http://localhost:3000/ssg/products")).toContain("/__404");
  });
});
