/**
 * View-model mapper for the customer Settings screen (SCR-ACC-09) -- `modules/users`'s `Me` +
 * `getMyProfile` result -> `components/account/types.ts`'s `CustomerProfile`.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `reduceMotion` has no backing column anywhere (`customer_profiles` only stores
 *    `notification_prefs`); it always maps to `false` and the screen's toggle stays a
 *    browser-session-only preference (not persisted server-side).
 *  - `SessionInfo` covers only the current session (`device` is the user agent, un-parsed) --
 *    `SecurityOverview.sessions` has the full list, but the screen only renders one "Active
 *    session" card, so the rest feed "Sign out everywhere" instead (see `site-mutations.ts`).
 *  - `AuthEvent[]` ("Recent sign-ins") is always empty -- there is no sign-in-history table, only
 *    `SecurityOverview.lastLoginAt`; the screen's own empty state ("No recent sign-ins") covers
 *    this honestly rather than fabricating login events.
 */
import type {
  AuthEvent,
  BillingDetails,
  CustomerProfile,
  SessionInfo,
} from "@/components/account/types";
import type { CustomerProfileView, Me, SessionView, UserView } from "@/modules/users/types";

function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function mapCustomerProfile(
  user: UserView,
  me: Me,
  profile: CustomerProfileView,
): CustomerProfile {
  const billing: BillingDetails = {
    name: profile.billingName ?? user.name,
    company: profile.company ?? undefined,
    line1: profile.billingAddress?.line1,
    line2: profile.billingAddress?.line2,
    city: profile.billingAddress?.city,
    state: profile.billingAddress?.state,
    postalCode: profile.billingAddress?.postalCode,
    country: profile.country ?? "IN",
    gstNumber: profile.gstNumber ?? undefined,
  };

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: me.emailVerified,
    initials: initials(user.name),
    displayCurrency: me.displayCurrency,
    themePref: me.themePref,
    reduceMotion: false,
    billing,
    phone: user.phoneNumber ?? undefined,
    emailProductUpdates: profile.notificationPrefs?.emailProductUpdates ?? true,
  };
}

export function mapSessionInfo(sessions: SessionView[]): SessionInfo {
  const current = sessions.find((s) => s.current) ?? sessions[0];
  return {
    device: current?.userAgent ?? "This device",
    ip: current?.ipAddress ?? "Unknown",
    lastActiveAt: current?.createdAt ?? new Date().toISOString(),
  };
}

export const NO_AUTH_EVENTS: AuthEvent[] = [];
