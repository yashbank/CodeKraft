/**
 * Host routing and request hardening (docs/04 §8, docs/09 §3.5, docs/12 §2.1, MASTER_SPEC §7).
 * Edge-safe: no imports from src/lib (env is read directly).
 */
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_HOST = process.env.ADMIN_HOST ?? "";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const APP_ENV = process.env.APP_ENV ?? "local";

function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function resolveHostKind(host: string): "admin" | "site" {
  return ADMIN_HOST !== "" && host === ADMIN_HOST ? "admin" : "site";
}

export function middleware(req: NextRequest): NextResponse {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const kind = resolveHostKind(host);
  const { pathname } = req.nextUrl;

  // Interim *.vercel.app → canonical domain once it exists (docs/12 §2.1)
  if (SITE_URL && host.endsWith(".vercel.app") && kind === "site") {
    const canonicalHost = new URL(SITE_URL).host;
    if (!canonicalHost.endsWith(".vercel.app") && canonicalHost !== host) {
      return NextResponse.redirect(new URL(pathname + req.nextUrl.search, SITE_URL), 308);
    }
  }

  const nonce = makeNonce();
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("x-host-kind", kind);

  let res: NextResponse;
  if (kind === "admin") {
    // Auth screens and APIs are shared by both hosts; everything else lives under /admin
    if (
      pathname.startsWith("/api/") ||
      pathname.startsWith("/admin") ||
      pathname === "/auth" ||
      pathname.startsWith("/auth/")
    ) {
      res = NextResponse.next({ request: { headers: reqHeaders } });
    } else {
      const url = req.nextUrl.clone();
      url.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
      res = NextResponse.rewrite(url, { request: { headers: reqHeaders } });
    }
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  } else if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/__404";
    res = NextResponse.rewrite(url, { request: { headers: reqHeaders } });
  } else {
    res = NextResponse.next({ request: { headers: reqHeaders } });
  }

  if (APP_ENV === "staging" || APP_ENV === "preview")
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("x-nonce", nonce);
  // Report-only CSP skeleton; enforced policy lands in P9.1 (docs/09 §9)
  res.headers.set(
    "Content-Security-Policy-Report-Only",
    `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`,
  );
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|brand/|noise.png).*)",
  ],
};
