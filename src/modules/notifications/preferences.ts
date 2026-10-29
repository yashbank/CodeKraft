/**
 * Per-category notification preferences (P14-12b), stored in `customer_profiles.notification_prefs`
 * (jsonb, no migration). Pure: the emit path asks `channelEnabled` before it writes an in-app row or
 * queues an email. Transactional types (receipts, payment/refund/suspension notices) always go out.
 */
import type { NotificationType } from "./types";

export const PREF_CATEGORIES = ["orders", "queries", "marketing"] as const;
export type PrefCategory = (typeof PREF_CATEGORIES)[number];
export const PREF_CHANNELS = ["email", "inapp"] as const;
export type PrefChannel = (typeof PREF_CHANNELS)[number];

export interface StoredPrefs {
  categories?: Partial<Record<PrefCategory, Partial<Record<PrefChannel, boolean>>>>;
  /** Legacy product-updates email switch; still read as the default for `marketing.email`. */
  emailProductUpdates?: boolean;
}

/** Never skipped, whatever the user chose. */
export const TRANSACTIONAL: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "order.paid",
  "payment.failed",
  "invoice.issued",
  "refund.issued",
  "license.ready",
  "subscription.suspended",
  "subscription.cancelled",
]);

const CATEGORY_OF: Partial<Record<NotificationType, PrefCategory>> = {
  "order.created": "orders",
  "payment.submitted": "orders",
  "delivery.task": "orders",
  "service.progress": "orders",
  "subscription.reminder": "orders",
  "subscription.grace": "orders",
  "entitlement.granted_manually": "orders",
  "quote.sent": "orders",
  "query.new": "queries",
  "query.replied": "queries",
  "query.customer_replied": "queries",
  "chat.cap_reached": "queries",
  "product.published": "marketing",
  "product.updated": "marketing",
};

export function categoryOf(type: NotificationType): PrefCategory | null {
  return CATEGORY_OF[type] ?? null;
}

/** Effective switch for one category + channel (default on). */
export function categoryEnabled(
  category: PrefCategory,
  channel: PrefChannel,
  prefs: StoredPrefs | null | undefined,
): boolean {
  const explicit = prefs?.categories?.[category]?.[channel];
  if (explicit !== undefined) return explicit;
  if (category === "marketing" && channel === "email") return prefs?.emailProductUpdates ?? true;
  return true;
}

/** May this notification type reach the user over this channel? Types with no category are always on. */
export function channelEnabled(
  type: NotificationType,
  channel: PrefChannel,
  prefs: StoredPrefs | null | undefined,
): boolean {
  if (TRANSACTIONAL.has(type)) return true;
  const category = categoryOf(type);
  return category ? categoryEnabled(category, channel, prefs) : true;
}

/** All categories resolved to concrete booleans, for the settings UI. */
export function resolveCategoryPrefs(
  prefs: StoredPrefs | null | undefined,
): Record<PrefCategory, Record<PrefChannel, boolean>> {
  const out = {} as Record<PrefCategory, Record<PrefChannel, boolean>>;
  for (const c of PREF_CATEGORIES)
    out[c] = { email: categoryEnabled(c, "email", prefs), inapp: categoryEnabled(c, "inapp", prefs) };
  return out;
}
