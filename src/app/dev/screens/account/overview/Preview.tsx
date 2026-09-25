"use client";

import { OverviewScreen } from "@/components/account/OverviewScreen";
import { entitlements, invoices, NOW, queries, wishlist } from "../../_fixtures/account";
import { DEV_LINKS, entitlementHref, orderHref, queryHref } from "../_links";

export function Preview({ state }: { state: string }) {
  const empty = state === "empty";
  return (
    <OverviewScreen
      firstName="Pravin"
      emailVerified={state !== "unverified"}
      actions={
        empty
          ? []
          : [
              {
                id: "a1",
                tone: "warning",
                title: "Order CK-ORD-000013 awaiting your payment",
                detail: "Storefront Kit · expires in 6 days 21 h",
                href: orderHref("ord_13"),
                cta: "Pay now",
              },
              {
                id: "a2",
                tone: "info",
                title: "Renewal due 3 Oct for Roster Cloud",
                detail: "Team workspace · ₹999.00 monthly",
                href: entitlementHref("ent_saas"),
                cta: "Renew",
              },
              {
                id: "a3",
                tone: "accent",
                title: "Reply from CodeKraft on 'Install issue on Windows 11'",
                detail: "Priya asked for a log file",
                href: queryHref("q_31"),
                cta: "Open",
              },
            ]
      }
      entitlements={empty ? [] : entitlements}
      invoices={empty ? [] : invoices}
      queries={empty ? [] : queries.filter((q) => q.status !== "resolved" && q.status !== "closed")}
      wishlistCount={empty ? 0 : wishlist.length}
      now={NOW}
      links={{
        purchases: DEV_LINKS.purchases,
        entitlement: entitlementHref,
        invoices: DEV_LINKS.invoices,
        queries: DEV_LINKS.queries,
        query: queryHref,
        wishlist: DEV_LINKS.wishlist,
        chat: DEV_LINKS.chat,
      }}
      loading={state === "loading"}
      error={state === "error" ? "The purchases service didn't respond in time." : null}
    />
  );
}
