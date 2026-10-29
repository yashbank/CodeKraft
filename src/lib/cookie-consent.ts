/**
 * Cookie notice (P14-12b). CodeKraft sets only essential and preference cookies (session, CSRF,
 * ck_theme, ck_currency) and its analytics (Umami) is cookieless, so nothing needs opt-in: the
 * notice is informational, shown once, dismissable. If a cookie-setting tool is ever added, add
 * Accept/Reject here and gate that tool on the stored value.
 */
export const NOTICE_KEY = "ck_cookie_notice";
export const NOTICE_SEEN = "seen";

export function shouldShowNotice(stored: string | null): boolean {
  return stored !== NOTICE_SEEN;
}
