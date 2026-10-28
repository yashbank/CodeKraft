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

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * CSP_MODE=enforce|report. Default is report-only until CSP_MODE=enforce is set: prerendered
 * routes (/, /blog, /contact, /legal/*, /auth/register) ship Next inline scripts without a
 * per-request nonce, so enforcing 'strict-dynamic' would break hydration there. Flip to
 * enforce once those routes are dynamic (or verified in a browser on preview).
 */
export function cspMode(): "enforce" | "report" {
  return process.env.CSP_MODE === "enforce" ? "enforce" : "report";
}

export function buildCsp(
  nonce: string,
  themeHash: string,
  frameAncestors = "'none'",
): { header: string; policy: string } {
  const dev = process.env.NODE_ENV !== "production";
  const media = originOf(process.env.NEXT_PUBLIC_MEDIA_BASE_URL);
  const umami = originOf(process.env.NEXT_PUBLIC_UMAMI_SRC);
  const sentry = originOf(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const turnstile = "https://challenges.cloudflare.com";
  const razorpayScript = "https://checkout.razorpay.com";
  const razorpayApi = ["https://api.razorpay.com", "https://checkout.razorpay.com"];
  // Presigned browser PUT to R2 (S3 API endpoint) + public media host.
  const r2 = "https://*.r2.cloudflarestorage.com";
  const list = (...xs: (string | null | false)[]) => xs.filter(Boolean).join(" ");
  const enforce = cspMode() === "enforce";
  const policy = [
    "default-src 'self'",
    // 'strict-dynamic' makes browsers ignore host sources; they remain as legacy fallback only.
    `script-src ${list("'self'", `'nonce-${nonce}'`, `'sha256-${themeHash}'`, "'strict-dynamic'", dev && "'unsafe-eval'", turnstile, razorpayScript, umami)}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `img-src ${list("'self'", "data:", "blob:", media, r2, "https://*.razorpay.com")}`,
    `connect-src ${list("'self'", turnstile, ...razorpayApi, "https://lumberjack.razorpay.com", media, r2, umami, sentry, "https://*.ingest.sentry.io", "https://*.ingest.us.sentry.io", dev && "ws:", dev && "wss:")}`,
    `frame-src ${list("'self'", turnstile, ...razorpayApi, media)}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://api.razorpay.com https://checkout.razorpay.com",
    `frame-ancestors ${frameAncestors}`,
    // Browsers ignore (and log a console error for) this directive in a report-only policy.
    ...(enforce ? ["upgrade-insecure-requests"] : []),
    "report-uri /api/csp-report",
    "report-to csp-endpoint",
  ].join("; ");
  return {
    header: enforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
    policy,
  };
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
  // The inline PDF preview iframes this same-origin route from product pages.
  const framable = pathname.startsWith("/api/files/product-media/");
  const csp = buildCsp(nonce, await getThemeScriptHash(), framable ? "'self'" : "'none'");
  const reqHeaders = new Headers(req.headers);
  // Next.js reads the nonce from the request CSP header to stamp its own inline scripts.
  reqHeaders.set(csp.header, csp.policy);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("x-host-kind", kind);
  // Original (pre-rewrite) path so server layouts can build a correct login `next`.
  reqHeaders.set("x-request-path", pathname + req.nextUrl.search);

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
  res.headers.set("X-Frame-Options", framable ? "SAMEORIGIN" : "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com")',
  );
  // allow-popups keeps Razorpay / OAuth popups able to talk back to the opener.
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");

  if (APP_ENV === "production" || APP_ENV === "staging") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  res.headers.set("x-nonce", nonce);

  // CSP was computed up-front (the nonce must also reach Next via the request headers).
  res.headers.set(csp.header, csp.policy);
  res.headers.set("Reporting-Endpoints", 'csp-endpoint="/api/csp-report"');
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|brand/|noise.png).*)",
  ],
};
