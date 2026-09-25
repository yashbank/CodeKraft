"use client";

import { QuoteScreen } from "@/components/account/QuoteScreen";
import type { QuoteView } from "@/components/account/types";
import { customer, NOW, quote } from "../../_fixtures/account";
import { DEV_LINKS, entitlementHref, orderHref } from "../_links";

export function Preview({ state }: { state: string }) {
  const q: QuoteView =
    state === "accepted"
      ? { ...quote, status: "accepted", orderHref: orderHref("ord_13") }
      : state === "paid"
        ? { ...quote, status: "paid", entitlementHref: entitlementHref("ent_service") }
        : state === "expired"
          ? { ...quote, status: "expired", validUntil: "2026-09-20T18:29:59Z" }
          : state === "cancelled"
            ? { ...quote, status: "cancelled" }
            : quote;
  return (
    <QuoteScreen
      quote={q}
      billing={customer.billing}
      customerEmail={customer.email}
      canAccept={state !== "readonly"}
      now={NOW}
      links={{ newQuery: DEV_LINKS.queries, switchAccount: `${DEV_LINKS.login}?state=default` }}
      loading={state === "loading"}
    />
  );
}
