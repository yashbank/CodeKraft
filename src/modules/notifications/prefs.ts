/**
 * Customer notification preferences (API-NOTIF-04, D-707, D-1002, X-012).
 *
 * Storage: `customer_profiles.notification_prefs` (`NotificationPrefs` in drizzle/schema/users-ext:
 * `{ email, inapp, emailProductUpdates? }`). API shape: `{ email: { orderUpdates: true (locked),
 * productUpdates, marketing?: false } }`. `orderUpdates` cannot be switched off; `marketing` is
 * absent in release 1.
 */
import type { NotificationPrefs } from "../../../drizzle/schema/users-ext";
import type { NotificationPreferences, NotificationType } from "./types";
import { templateFor } from "./templates";

export const DEFAULT_DB_PREFS: NotificationPrefs = Object.freeze({
  email: true,
  inapp: true,
  emailProductUpdates: true,
}) as NotificationPrefs;

export function toApiPreferences(db: NotificationPrefs | null | undefined): NotificationPreferences {
  return {
    email: {
      orderUpdates: true,
      productUpdates: db?.emailProductUpdates ?? true,
      marketing: false,
    },
  };
}

export function toDbPreferences(
  api: NotificationPreferences,
  existing: NotificationPrefs | null | undefined,
): NotificationPrefs {
  return {
    ...(existing ?? DEFAULT_DB_PREFS),
    email: true, // orderUpdates locked on (API-NOTIF-04)
    inapp: true,
    emailProductUpdates: api.email.productUpdates,
  };
}

/** Whether the customer's preferences allow an email for `type` (`orderUpdates` is always on). */
export function emailAllowedByPrefs(
  prefs: NotificationPreferences | null | undefined,
  type: NotificationType,
): boolean {
  const category = templateFor(type).prefCategory;
  if (category === "orderUpdates") return true;
  return prefs?.email.productUpdates ?? true;
}
