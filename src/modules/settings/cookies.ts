/**
 * `ck_currency` / `ck_theme` cookie writer for API-AUTH-04 / API-AUTH-10 (D-905, D-502): one year,
 * not HttpOnly (the ≤ 300-byte head script reads `ck_theme` before paint), `SameSite=Lax`.
 * `next/headers` is imported lazily so services and unit tests never touch the request scope.
 */
import { VISITOR_COOKIE_MAX_AGE_S } from "./types";

export type PreferenceCookies = { ck_currency?: string; ck_theme?: string };

export interface CookieWriter {
  set(name: string, value: string, options: Record<string, unknown>): void;
}

export function cookieOptions(secure: boolean): Record<string, unknown> {
  return {
    maxAge: VISITOR_COOKIE_MAX_AGE_S,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure,
  };
}

export function writePreferenceCookies(
  writer: CookieWriter,
  cookies: PreferenceCookies,
  secure: boolean,
): void {
  for (const [name, value] of Object.entries(cookies)) {
    if (value !== undefined) writer.set(name, value, cookieOptions(secure));
  }
}

/** Server-Action helper: applies the cookies on the current response. */
export async function applyPreferenceCookies(cookies: PreferenceCookies): Promise<void> {
  if (Object.keys(cookies).length === 0) return;
  const [{ cookies: nextCookies }, { getEnv }] = await Promise.all([
    import("next/headers"),
    import("@/lib/env"),
  ]);
  const store = await nextCookies();
  const env = getEnv();
  const secure = env.APP_ENV === "production" || env.NEXT_PUBLIC_SITE_URL.startsWith("https://");
  writePreferenceCookies(store, cookies, secure);
}
