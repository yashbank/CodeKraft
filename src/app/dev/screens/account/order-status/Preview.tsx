"use client";

import { OrderStatusScreen } from "@/components/account/OrderStatusScreen";
import type { OrderView } from "@/components/account/types";
import { NOW, orders, type OrderPreviewState } from "../../_fixtures/account";
import { DEV_LINKS, entitlementHref } from "../_links";

export function Preview({ state }: { state: string }) {
  const order: OrderView =
    state === "cancelled"
      ? { ...orders.expired, status: "cancelled", failedReason: "cancelled_by_customer" }
      : state === "paid"
        ? { ...orders.confirmed, status: "paid" }
        : orders[(state in orders ? state : "awaitingReference") as OrderPreviewState];
  return (
    <OrderStatusScreen
      order={order}
      now={NOW}
      links={{
        purchases: DEV_LINKS.purchases,
        entitlement: order.entitlementId ? entitlementHref(order.entitlementId) : undefined,
        newQuery: DEV_LINKS.queries,
        product: "/products/storefront-kit",
      }}
      loading={state === "loading"}
    />
  );
}
