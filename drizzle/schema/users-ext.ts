/**
 * Identity extension tables (docs/05 §1): permissions, role_permissions, partners, customer_profiles.
 * `users`, `roles` and `user_roles` live in ./auth.ts (P1.5); this file only adds to them.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { roles, users } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** Permission strings (docs/09 §5, TM-14): seeded from src/lib/authz/permissions.ts and diffed in CI. */
export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
  description: text("description").notNull().default(""),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleKey: text("role_key")
      .notNull()
      .references(() => roles.key, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roleKey, t.permissionKey] })],
);

/** T-partners — an admin who can hold ownership shares. Payout details are encrypted at rest (docs/09). */
export const partners = pgTable(
  "partners",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    displayName: text("display_name").notNull(),
    /** AES-GCM envelope (src/lib/crypto.ts) of the partner's bank/UPI details; never returned to the UI in clear. */
    payoutBankDetailsEnc: text("payout_bank_details_enc"),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("partners_active_idx").on(t.active)],
);

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  /** ISO-3166-1 alpha-2 */
  country: string;
}

/** API-NOTIF-04: `orderUpdates` is locked true; `marketing` absent in release 1 (D-707). */
export interface NotificationPrefs {
  email: boolean;
  inapp: boolean;
  emailProductUpdates?: boolean;
}

/** T-customer_profiles — one row per customer, keyed by the user id. */
export const customerProfiles = pgTable(
  "customer_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    company: text("company"),
    billingName: text("billing_name"),
    billingAddress: jsonb("billing_address").$type<BillingAddress>(),
    country: char("country", { length: 2 }),
    gstNumber: text("gst_number"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    internalNotes: text("internal_notes"),
    notificationPrefs: jsonb("notification_prefs")
      .$type<NotificationPrefs>()
      .notNull()
      .default(sql`'{"email":true,"inapp":true}'::jsonb`),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("customer_profiles_country_idx").on(t.country)],
);

export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type Partner = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;
export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type NewCustomerProfile = typeof customerProfiles.$inferInsert;
