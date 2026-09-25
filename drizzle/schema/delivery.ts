/**
 * Entitlements & delivery (docs/05 §6): entitlements, subscriptions, service_progress, downloads,
 * delivery_tasks, release_files. Decisions D-601–D-608, D-1108 (manual grants: `order_item_id` null,
 * no synthetic order), MASTER_SPEC §7 "Subscription grace" / "Renewal order expiry".
 *
 * Cross-domain FKs (offerings, products, order_items, orders, media) are wired (P2.4): grants and
 * download history are `restrict`; the optional renewal-order link is `set null`.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { products } from "./catalog";
import { orderItems, orders } from "./commerce";
import { media } from "./media";
// Shared Postgres enums are defined once on offerings (docs/05 §3); reused here, never duplicated.
import { billingInterval, deliveryType, offerings, updatePolicy } from "./offerings";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const entitlementStatus = pgEnum("entitlement_status", [
  "pending",
  "active",
  "suspended",
  "expired",
  "revoked",
]);
export const provisioningState = pgEnum("provisioning_state", ["n/a", "pending", "done"]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "cancelled",
]);
export const deliveryTaskKind = pgEnum("delivery_task_kind", ["provision", "revoke_external"]);
export const deliveryTaskStatus = pgEnum("delivery_task_status", ["open", "done"]);

/** T-entitlements — one row per purchased (or manually granted) offering. */
export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    offeringId: uuid("offering_id")
      .notNull()
      .references(() => offerings.id, { onDelete: "restrict" }),
    /** null = manual admin grant (D-1108); unique when set (one entitlement per order item). */
    orderItemId: uuid("order_item_id").references(() => orderItems.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    deliveryType: deliveryType("delivery_type").notNull(),
    status: entitlementStatus("status").notNull().default("pending"),
    accessStartsAt: ts("access_starts_at").notNull().defaultNow(),
    /** null = lifetime access (D-605). */
    accessEndsAt: ts("access_ends_at"),
    updatePolicy: updatePolicy("update_policy").notNull(),
    downloadCap: integer("download_cap"),
    downloadsUsed: integer("downloads_used").notNull().default(0),
    /** Encrypted at rest by the application (docs/09); never returned raw. */
    licenseKeyEnc: text("license_key_enc"),
    provisioningState: provisioningState("provisioning_state").notNull().default("n/a"),
    provisioningNotes: jsonb("provisioning_notes"),
    grantedManuallyBy: uuid("granted_manually_by").references(() => users.id),
    revokedAt: ts("revoked_at"),
    revokeReason: text("revoke_reason"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("entitlements_order_item_uq")
      .on(t.orderItemId)
      .where(sql`order_item_id is not null`),
    index("entitlements_user_status_idx").on(t.userId, t.status),
    index("entitlements_offering_idx").on(t.offeringId),
    index("entitlements_product_idx").on(t.productId),
    index("entitlements_status_access_ends_idx").on(t.status, t.accessEndsAt), // expiry cron (FR-DEL-10)
  ],
);

/** T-subscriptions — renewal state for subscription offerings (D-521). */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    entitlementId: uuid("entitlement_id")
      .notNull()
      .unique()
      .references(() => entitlements.id, { onDelete: "cascade" }),
    interval: billingInterval("interval").notNull(),
    currentPeriodStart: ts("current_period_start").notNull(),
    currentPeriodEnd: ts("current_period_end").notNull(),
    /** period_end + 7 d while `past_due`; the renewal order's `expires_at` equals this (MASTER_SPEC §7). */
    graceUntil: ts("grace_until"),
    status: subscriptionStatus("status").notNull().default("active"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    renewalOrderId: uuid("renewal_order_id").references(() => orders.id, { onDelete: "set null" }),
    reminderSentAt: ts("reminder_sent_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("subscriptions_status_period_end_idx").on(t.status, t.currentPeriodEnd),
    index("subscriptions_renewal_order_idx").on(t.renewalOrderId),
  ],
);

/** T-service_progress — checklist rows copied from `offerings.service_steps` (D-608). */
export const serviceProgress = pgTable(
  "service_progress",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    entitlementId: uuid("entitlement_id")
      .notNull()
      .references(() => entitlements.id, { onDelete: "cascade" }),
    stepKey: text("step_key").notNull(),
    doneAt: ts("done_at"),
    doneBy: uuid("done_by").references(() => users.id),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("service_progress_entitlement_step_uq").on(t.entitlementId, t.stepKey)],
);

/** T-downloads — one row per signed-link issue, counted against `download_cap` (BR-15). */
export const downloads = pgTable(
  "downloads",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    entitlementId: uuid("entitlement_id")
      .notNull()
      .references(() => entitlements.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("downloads_entitlement_idx").on(t.entitlementId),
    index("downloads_user_idx").on(t.userId),
    index("downloads_media_idx").on(t.mediaId),
  ],
);

/** T-delivery_tasks — manual provisioning / external revocation work items (D-607). */
export const deliveryTasks = pgTable(
  "delivery_tasks",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    entitlementId: uuid("entitlement_id")
      .notNull()
      .references(() => entitlements.id, { onDelete: "cascade" }),
    kind: deliveryTaskKind("kind").notNull(),
    status: deliveryTaskStatus("status").notNull().default("open"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    doneAt: ts("done_at"),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("delivery_tasks_entitlement_idx").on(t.entitlementId),
    index("delivery_tasks_status_kind_idx").on(t.status, t.kind), // daily digest of open revoke_external
    index("delivery_tasks_assigned_to_idx").on(t.assignedTo),
  ],
);

/** T-release_files — downloadable builds per product version (D-604). */
export const releaseFiles = pgTable(
  "release_files",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    notes: text("notes"),
    releasedAt: ts("released_at").notNull().defaultNow(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("release_files_product_version_idx").on(t.productId, t.version),
    index("release_files_media_idx").on(t.mediaId),
  ],
);

export type Entitlement = typeof entitlements.$inferSelect;
export type NewEntitlement = typeof entitlements.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type ServiceProgress = typeof serviceProgress.$inferSelect;
export type NewServiceProgress = typeof serviceProgress.$inferInsert;
export type Download = typeof downloads.$inferSelect;
export type NewDownload = typeof downloads.$inferInsert;
export type DeliveryTask = typeof deliveryTasks.$inferSelect;
export type NewDeliveryTask = typeof deliveryTasks.$inferInsert;
export type ReleaseFile = typeof releaseFiles.$inferSelect;
export type NewReleaseFile = typeof releaseFiles.$inferInsert;
