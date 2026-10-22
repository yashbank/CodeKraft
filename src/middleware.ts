/**
 * Host routing and request hardening (docs/04 §8, docs/09 §3.5, docs/12 §2.1, MASTER_SPEC §7).
 * Edge-safe: no imports from src/lib (env is read directly).
 */
import { NextResponse, type NextRequest } from "next/server";
import { inlineThemeScript } from "@/lib/theme";

const ADMIN_HOST = process.env.ADMIN_HOST ?? "";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const APP_ENV = process.env.APP_ENV ?? "local";
const LIGHT_ENABLED = process.env.FEATURE_THEME_LIGHT_EDITORIAL === "true";

function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function sha256Base64(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  let s = "";
  for (const b of new Uint8Array(digest)) s += String.fromCharCode(b);
  return btoa(s);
}

// Root layout's inline theme script is static per deployment (docs/08 §10) - hash
// allow-list it once instead of making the layout dynamic just to apply a nonce.
let themeScriptHashPromise: Promise<string> | null = null;
function getThemeScriptHash(): Promise<string> {
  themeScriptHashPromise ??= sha256Base64(inlineThemeScript(LIGHT_ENABLED));
  return themeScriptHashPromise;
}

export function resolveHostKind(host: string): "admin" | "site" {
  return ADMIN_HOST !== "" && host === ADMIN_HOST ? "admin" : "site";
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
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
      pathname === "/admin" ||
      pathname.startsWith("/admin/") ||
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

  if (APP_ENV === "staging" || APP_ENV === "preview") {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  // Security Headers (docs/09 §9, P9.1)
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  if (APP_ENV === "production" || APP_ENV === "staging") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  res.headers.set("x-nonce", nonce);

  const themeScriptHash = await getThemeScriptHash();

  // CSP Policy with nonce and CSP violation reporting
  const cspPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'sha256-${themeScriptHash}' 'strict-dynamic' 'unsafe-eval' https:`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "report-uri /api/csp-report",
  ].join("; ");

  res.headers.set("Content-Security-Policy-Report-Only", cspPolicy);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|brand/|noise.png).*)",
  ],
};
