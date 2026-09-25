/** Preview routes for the account group so in-screen navigation stays inside /dev/screens. */
export const BASE = "/dev/screens/account";

export const DEV_LINKS = {
  overview: `${BASE}/overview`,
  purchases: `${BASE}/purchases`,
  invoices: `${BASE}/invoices`,
  queries: `${BASE}/queries`,
  chat: `${BASE}/chat`,
  wishlist: `${BASE}/wishlist`,
  notifications: `${BASE}/notifications`,
  settings: `${BASE}/settings`,
  checkout: `${BASE}/checkout`,
  quote: `${BASE}/quote`,
  verify: `${BASE}/verify-email`,
  login: `${BASE}/login`,
} as const;

export const entitlementHref = (id: string) => `${BASE}/entitlement?state=${entitlementState(id)}`;
export const orderHref = (idOrNumber: string) =>
  `${BASE}/order-status?state=${orderState(idOrNumber)}`;
export const queryHref = (id: string) =>
  `${BASE}/query-thread?state=${id === "q_30" ? "resolved" : "waiting"}`;
export const transcriptHref = (_id: string) => `${BASE}/chat`;

function entitlementState(id: string): string {
  switch (id) {
    case "ent_license":
      return "license";
    case "ent_saas":
      return "saas";
    case "ent_service":
      return "service";
    case "ent_hosted_sub":
      return "subscription";
    case "ent_expired":
      return "expired";
    default:
      return "download";
  }
}

function orderState(idOrNumber: string): string {
  if (idOrNumber.endsWith("12")) return "confirmed";
  if (idOrNumber.endsWith("10")) return "expired";
  if (idOrNumber.endsWith("09") || idOrNumber.endsWith("9")) return "refunded";
  return "awaitingReference";
}
