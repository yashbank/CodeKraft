/**
 * View-model mappers: `modules/users` customer shapes -> admin component prop shapes
 * (`components/admin/types`). Kept out of the page components per the phase convention (mapping
 * never lives in a component) and out of the components themselves (they stay props-driven).
 *
 * Known gaps vs. a fully-populated screen -- see the phase report for the full list:
 *  - `openOrders` / `openQueries` are always 0: `listCustomers` / `getCustomer` only return an
 *    aggregate total order/entitlement count (`stats.orders`, `stats.entitlements`), not a
 *    per-status breakdown. Computing "open" counts would need one extra `orders`/`queries` query
 *    per customer row, which isn't worth it for a list of up to 100 rows -- left at 0 rather than
 *    mislabeling the total as "open".
 *  - `activeEntitlements` uses `stats.entitlements`, the customer's TOTAL entitlement count (the
 *    users module has no active-only breakdown either); it is not filtered to `status: "active"`.
 *  - `lastSeenAt` / `anonymisedAt` are always `undefined`: `UserView` has no last-login timestamp,
 *    and `listCustomers`/`getCustomer` don't project an anonymisation timestamp per row (only
 *    `usersService.deleteAccount` returns one, for the self-service flow).
 *  - `CustomerDetailData.entitlements` and `.queries` are always empty arrays: the entitlements
 *    and queries modules' admin queries/actions are out of this phase's scope (owned by a
 *    different phase per their own module headers) -- the Entitlements/Queries tabs on the
 *    customer detail page render their existing empty states rather than fabricated rows.
 *  - `chatUsage` is always `{ today: 0, cap: 0 }`: no chat module data is wired here.
 *  - `notesHistory` is always `[]`: `customer_profiles.internal_notes` has no revision log.
 *  - `flags` is always `{ chargeback: false }`: no chargeback tracking exists in this scope.
 *  - Timeline `actor` is always the customer's own name: `CustomerTimelineItem` doesn't record
 *    which admin/system performed each event separately (unlike the orders audit-based timeline).
 */
import type { Currency } from "@/lib/money";
import type { OrderAdminRow } from "@/modules/orders/types";
import type {
  BillingAddress,
  CustomerDetail as ModuleCustomerDetail,
  CustomerRow as ModuleCustomerRow,
} from "@/modules/users/types";
import type {
  CustomerDetailData,
  CustomerRow,
  OrderRow,
  TimelineEvent,
} from "@/components/admin/types";

export function mapCustomerRow(row: ModuleCustomerRow): CustomerRow {
  return {
    id: row.user.id,
    name: row.user.name,
    email: row.user.email,
    verified: row.user.emailVerified,
    company: row.profile?.company ?? undefined,
    country: row.profile?.country ?? "—",
    tags: row.profile?.tags ?? [],
    activeEntitlements: row.stats.entitlements,
    lifetimeSpendInr: row.stats.spentInrMinor,
    openOrders: 0,
    openQueries: 0,
    status: row.user.status,
    joinedAt: row.user.createdAt,
    lastSeenAt: undefined,
    anonymisedAt: undefined,
  };
}

function formatBillingAddress(address: BillingAddress | null | undefined): string {
  if (!address) return "—";
  const line2 = address.line2 ? `, ${address.line2}` : "";
  const state = address.state ? `, ${address.state}` : "";
  return `${address.line1}${line2}, ${address.city}${state} ${address.postalCode}`.trim();
}

export function mapCustomerDetail(
  detail: ModuleCustomerDetail,
  orders: OrderAdminRow[],
  mapOrder: (row: OrderAdminRow, now: string) => OrderRow,
  now: string,
): CustomerDetailData {
  const customer = mapCustomerRow(detail);

  const activity: TimelineEvent[] = detail.timeline.map((item) => ({
    at: item.at,
    actor: detail.user.name,
    text: item.summary,
  }));

  const profile = detail.profile;

  return {
    customer,
    phone: detail.user.phoneNumber ?? undefined,
    stats: {
      lifetimeSpendInr: detail.stats.spentInrMinor,
      orders: detail.stats.orders,
      activeEntitlements: detail.stats.entitlements,
      openQueries: 0,
    },
    orders: orders.map((o) => mapOrder(o, now)),
    entitlements: [],
    queries: [],
    activity,
    chatUsage: { today: 0, cap: 0 },
    notes: detail.internalNotes ?? "",
    notesHistory: [],
    billing: {
      name: profile?.billingName ?? detail.user.name,
      address: formatBillingAddress(profile?.billingAddress),
      country: profile?.country ?? "—",
      gstin: profile?.gstNumber ?? undefined,
      lastUsedAt: detail.lastOrderAt ?? detail.user.createdAt,
    },
    preferences: {
      currency: detail.user.displayCurrency as Currency,
      theme: detail.user.themePref ?? "Site default",
      emailPrefs: profile?.notificationPrefs?.email
        ? "Order + product updates"
        : "Order updates only",
    },
    flags: { chargeback: false },
    offeringOptions: [],
  };
}
