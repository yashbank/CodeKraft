"use client";

import { SettingsScreen } from "@/components/account/SettingsScreen";
import { authEvents, customer, NOW, session } from "../../_fixtures/account";

export function Preview({ state }: { state: string }) {
  return (
    <SettingsScreen
      profile={customer}
      session={session}
      authEvents={state === "no-history" ? [] : authEvents}
      now={NOW}
      themeFlagOn={state === "theme-flag"}
      phoneOtpOn={state === "phone-flag"}
      deleteBlocked={state === "delete-blocked"}
      loading={state === "loading"}
    />
  );
}
