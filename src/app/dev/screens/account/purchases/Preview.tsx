"use client";

import { PurchasesScreen } from "@/components/account/PurchasesScreen";
import { entitlements, expiredEntitlement, NOW, orders } from "../../_fixtures/account";
import { DEV_LINKS } from "../_links";

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
      links={{ entitlement: DEV_LINKS.entitlement, order: DEV_LINKS.orderStatus }}
      loading={state === "loading"}
      error={state === "error" ? "Couldn't load your purchases." : null}
    />
  );
}
