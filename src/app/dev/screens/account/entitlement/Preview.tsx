"use client";

import { EntitlementDetailScreen } from "@/components/account/EntitlementDetailScreen";
import type { EntitlementDetail } from "@/components/account/types";
import { entitlements, expiredEntitlement } from "../../_fixtures/account";
import { DEV_LINKS, orderHref } from "../_links";

function pick(state: string): EntitlementDetail {
  const by = (id: string) => entitlements.find((e) => e.id === id) ?? expiredEntitlement;
  switch (state) {
    case "license":
      return by("ent_license");
    case "license-pending":
      return {
        ...by("ent_license"),
        licenseKey: undefined,
        keyIssued: false,
        secondaryLine: "Key not issued yet",
      };
    case "saas":
      return by("ent_saas");
    case "saas-ready":
      return { ...by("ent_saas"), provisioningState: "done", secondaryLine: undefined };
    case "service":
      return by("ent_service");
    case "service-done":
      return {
        ...by("ent_service"),
        steps: (by("ent_service").steps ?? []).map((s) => ({
          ...s,
          state: "done" as const,
          doneAt: s.doneAt ?? "2026-09-24T10:00:00Z",
        })),
      };
    case "subscription":
      return by("ent_hosted_sub");
    case "cancelled": {
      const sub = by("ent_hosted_sub");
      return sub.subscription
        ? {
            ...sub,
            status: "active",
            subscription: { ...sub.subscription, status: "cancelled", cancelAtPeriodEnd: true },
          }
        : sub;
    }
    case "expired":
      return expiredEntitlement;
    case "cap-reached":
      return { ...by("ent_download"), downloadsUsed: 5, secondaryLine: "0 of 5 downloads left" };
    default:
      return by("ent_download");
  }
}

export function Preview({ state }: { state: string }) {
  const e = pick(state);
  return (
    <EntitlementDetailScreen
      entitlement={e}
      links={{
        purchases: DEV_LINKS.purchases,
        order: orderHref(e.orderNumber),
        invoice: DEV_LINKS.invoices,
        newQuery: DEV_LINKS.queries,
        renew: `${DEV_LINKS.checkout}?state=renewal`,
      }}
      loading={state === "loading"}
    />
  );
}
