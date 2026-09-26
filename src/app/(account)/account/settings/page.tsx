import { SettingsScreen } from "@/components/account/SettingsScreen";
import {
  authEvents,
  customer,
  session as sessionFixture,
} from "@/app/dev/screens/_fixtures/account";
import { getSession } from "@/modules/auth/service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const currentSession = await getSession();

  const profile = {
    ...customer,
    name: currentSession?.user.name || customer.name,
    email: currentSession?.user.email || customer.email,
  };

  return (
    <SettingsScreen
      profile={profile}
      session={sessionFixture}
      authEvents={authEvents}
      now={new Date().toISOString()}
      themeFlagOn={true}
      phoneOtpOn={false}
      deleteBlocked={false}
    />
  );
}
