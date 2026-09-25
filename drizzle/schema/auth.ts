/**
 * Identity tables (docs/05 §1). Better Auth owns sessions/accounts/verifications/two_factor and the
 * core user fields; CodeKraft adds its own user columns (status, display_currency, theme_pref, phone,
 * deletion markers). Roles are plain rows (A-201, D-201). P2 extends this file with the rest of the schema.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const citext = customType<{ data: string }>({ dataType: () => "citext" });

export const userStatus = pgEnum("user_status", ["active", "suspended", "deleted"]);
export const themePref = pgEnum("theme_pref", ["dark-cinematic", "light-editorial"]);

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // Better Auth core fields
    name: text("name").notNull().default(""),
    email: citext("email").notNull().unique(), // phone-only accounts get a synthetic address (phone plugin)
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    // plugin fields
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    phoneNumber: text("phone_number").unique(),
    phoneNumberVerified: boolean("phone_number_verified").notNull().default(false),
    // CodeKraft fields (docs/05 T-users)
    status: userStatus("status").notNull().default("active"),
    displayCurrency: text("display_currency").notNull().default("INR"),
    themePref: themePref("theme_pref"),
    deletedAt: ts("deleted_at"),
    anonymizedAt: ts("anonymized_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("users_status_idx").on(t.status)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /** 'site' | 'admin' — which Better Auth instance issued it (docs/09 §3.5) */
    host: text("host").notNull().default("site"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"), // argon2id hash for the credential provider
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId),
    index("accounts_provider_idx").on(t.providerId, t.accountId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const twoFactor = pgTable(
  "two_factor",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").notNull().default(false),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: ts("locked_until"),
  },
  (t) => [index("two_factor_user_idx").on(t.userId)],
);

/** Roles & permissions (docs/05 T-roles). Permission strings live in src/lib/authz/permissions.ts. */
export const roles = pgTable("roles", { key: text("key").primaryKey() });

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleKey: text("role_key")
      .notNull()
      .references(() => roles.key),
    grantedBy: uuid("granted_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleKey] })],
);

/** Better Auth (usePlural) looks up the two-factor model as `twoFactors`. */
export const twoFactors = twoFactor;

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
