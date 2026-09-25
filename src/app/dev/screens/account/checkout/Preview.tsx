"use client";

import { CheckoutScreen, type CheckoutPageState } from "@/components/account/CheckoutScreen";
import { money } from "@/lib/money";
import { checkoutOffering, customer } from "../../_fixtures/account";
import { DEV_LINKS } from "../_links";

export function Preview({ state }: { state: string }) {
  const offering =
    state === "renewal"
      ? {
          ...checkoutOffering,
          productName: "Roster Cloud",
          offeringName: "Team workspace · Monthly",
          purchaseModelLine: "Monthly subscription · renews every month",
          deliveryType: "saas" as const,
          unit: money(99_900, "INR"),
          tax: money(17_982, "INR"),
          displayEstimate: money(1_416, "USD"),
          renewal: { periodLabel: "3 Oct – 2 Nov 2026" },
        }
      : checkoutOffering;
  const pageState: CheckoutPageState =
    state === "renewal"
      ? "default"
      : state === "rate-limited"
        ? "rate_limited"
        : (state as CheckoutPageState);
  return (
    <CheckoutScreen
      offering={offering}
      customerEmail={customer.email}
      billing={customer.billing}
      coupon={{ code: "SAVE10", percentBps: 1000 }}
      state={pageState}
      links={{ dashboard: DEV_LINKS.overview, verify: DEV_LINKS.verify }}
    />
  );
}
