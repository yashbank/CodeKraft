import type { HelpRole, HelpSource } from "./types";

/** A path is linkable only when it is a same-site absolute path. */
export function safePath(p: unknown): string | null {
  return typeof p === "string" && /^\/(?!\/)[\w\-./?=&#%]*$/.test(p) ? p : null;
}

const ACCOUNT: Array<[RegExp, string]> = [
  [/invoice/, "/account/invoices"],
  [/purchase|download|entitle/, "/account/purchases"],
  [/order|pay/, "/account/orders"],
  [/quote/, "/account/quotes"],
  [/wish/, "/account/wishlist"],
  [/notif/, "/account/notifications"],
  [/quer|support|ticket/, "/account/queries"],
  [/chat/, "/account/chat"],
  [/setting|profile|password|account/, "/account/settings"],
  [/product|catalog/, "/products"],
  [/service/, "/services"],
  [/contact/, "/contact"],
];
const ADMIN: Array<[RegExp, string]> = [
  [/approval/, "/approvals"],
  [/finance|ledger|expense|payout/, "/finance"],
  [/order|pay/, "/orders"],
  [/product|catalog/, "/products"],
  [/categor/, "/categories"],
  [/coupon/, "/coupons"],
  [/lead/, "/leads"],
  [/customer/, "/customers"],
  [/entitle/, "/entitlements"],
  [/deliver/, "/delivery-tasks"],
  [/quote/, "/quotes"],
  [/quer|support/, "/queries"],
  [/content|blog/, "/content"],
  [/audit/, "/audit"],
  [/setting/, "/settings"],
  [/notif/, "/notifications"],
  [/dashboard/, "/dashboard"],
];

/** Screen a source points to: its own safe `path`, else a guess from the guide id (per area). */
export function sourceHref(s: HelpSource, role: HelpRole): string | null {
  const own = safePath(s.path);
  if (own) return own;
  const table = role === "customer" || role === "partner" ? ACCOUNT : ADMIN;
  const id = s.id.toLowerCase();
  return table.find(([re]) => re.test(id))?.[1] ?? null;
}
