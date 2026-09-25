"use client";

import { PurchasesScreen } from "@/components/account/PurchasesScreen";
import { entitlements, expiredEntitlement, NOW, orders } from "../../_fixtures/account";
import { entitlementHref, orderHref } from "../_links";

export function Preview({ state }: { state: string }) {
  const empty = state === "empty";
  return (
    <PurchasesScreen
      entitlements={empty ? [] : [...entitlements, expiredEntitlement]}
      orders={
        empty
          ? []
          : [
              orders.awaitingReference,
              orders.failedAttempt,
              orders.confirmed,
              orders.expired,
              orders.refunded,
            ]
      }
      now={NOW}
      links={{ entitlement: entitlementHref, order: orderHref }}
      loading={state === "loading"}
      error={state === "error" ? "Couldn't load your purchases." : null}
    />
  );
}
