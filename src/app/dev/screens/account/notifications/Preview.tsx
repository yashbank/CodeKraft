"use client";

import { NotificationsScreen } from "@/components/account/NotificationsScreen";
import { notifications, NOW } from "../../_fixtures/account";
import { DEV_LINKS } from "../_links";

export function Preview({ state }: { state: string }) {
  return (
    <NotificationsScreen
      items={state === "empty" ? [] : notifications}
      now={NOW}
      links={{ settings: DEV_LINKS.settings }}
      loading={state === "loading"}
    />
  );
}
