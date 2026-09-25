"use client";

import { QueryThreadScreen } from "@/components/account/QueriesScreen";
import { NOW, queries } from "../../_fixtures/account";
import { DEV_LINKS } from "../_links";

export function Preview({ state }: { state: string }) {
  const [waiting, resolved] = queries;
  if (!waiting || !resolved) return null;
  const query =
    state === "resolved"
      ? resolved
      : state === "closed"
        ? { ...resolved, status: "closed" as const }
        : waiting;
  return (
    <QueryThreadScreen
      query={query}
      now={NOW}
      links={{ queries: DEV_LINKS.queries }}
      sendError={state === "send-error"}
    />
  );
}
