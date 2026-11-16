import { safeRedirectPath } from "@/lib/safe-redirect";

/** One-time token lifetime for the site -> admin handoff (better-auth counts whole minutes). */
export const HANDOFF_TOKEN_TTL_MINUTES = 1;

export const HANDOFF_PATH = "/auth/handoff";

/**
 * The token goes in the URL fragment: browsers never send it to the server, so it stays out of
 * access logs, proxies and Referer headers. The handoff page POSTs it to the exchange endpoint.
 */
export function buildHandoffUrl(adminUrl: string, token: string, next: string): string {
  const frag = new URLSearchParams({ token, next: safeRedirectPath(next, "/dashboard") });
  return `${adminUrl}${HANDOFF_PATH}#${frag.toString()}`;
}

/** Parse `#token=...&next=...`. Only the fragment is trusted; query-string tokens are ignored. */
export function parseHandoffFragment(hash: string): { token: string | null; next: string } {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return {
    token: params.get("token") || null,
    next: safeRedirectPath(params.get("next"), "/dashboard"),
  };
}

/** True for the token exchange/mint endpoints of the better-auth one-time-token plugin. */
export function isHandoffApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/auth/one-time-token/");
}

/** Headers that keep a handoff token out of caches and Referer. */
export function applyHandoffHeaders(headers: Headers): void {
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
}
