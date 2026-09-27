import { SettingsScreen } from "@/components/account/SettingsScreen";
import { NO_AUTH_EVENTS, mapCustomerProfile, mapSessionInfo } from "@/lib/account/settings-view";
import { getFlag } from "@/lib/feature-flags";
import { getMeQuery, getMyProfileQuery, getSecurityOverviewQuery } from "@/modules/users/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
  const ctx = await getSiteRequestContext();

  const [meResult, profileResult, securityResult, themeFlagOn, phoneOtpOn] = await Promise.all([
    getMeQuery({}, ctx),
    getMyProfileQuery({}, ctx),
    getSecurityOverviewQuery({}, ctx),
    getFlag("theme_light_editorial"),
    getFlag("phone_otp"),
  ]);

  if (!meResult.ok || !profileResult.ok) {
    // Both are `account.self` reads scoped to the signed-in session established by the layout
    // above, so this only happens on an unexpected backend error.
    throw new Error(
      !meResult.ok ? meResult.error.message : !profileResult.ok ? profileResult.error.message : "",
    );
  }

  const profile = mapCustomerProfile(meResult.data.user, meResult.data, profileResult.data.profile);
  const session = mapSessionInfo(securityResult.ok ? securityResult.data.sessions : []);

  return (
    <SettingsScreen
      profile={profile}
      session={session}
      authEvents={NO_AUTH_EVENTS}
      now={new Date().toISOString()}
      themeFlagOn={themeFlagOn}
      phoneOtpOn={phoneOtpOn}
      deleteBlocked={false}
    />
  );
}
