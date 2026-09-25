/**
 * Dashboard, analytics and operational tables (docs/05 §11): dashboard_layouts, analytics_events,
 * job_runs, webhook_events, files_upload_intents, rate_limit_buckets. `wishlists` (same section) is
 * a user-extension table owned by domain A.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
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

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const jobStatus = pgEnum("job_status", ["ok", "error"]);

/** dashboard_layouts — per-admin react-grid-layout state (D-120, API-ADM-13). */
export const dashboardLayouts = pgTable("dashboard_layouts", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** `[{ i: widgetKey, x, y, w, h }]` */
  layout: jsonb("layout").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** analytics_events — first-party product analytics (`A:` column in docs/06). */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    anonId: text("anon_id"),
    productId: uuid("product_id"), // FK → products.id (P2.4)
    orderId: uuid("order_id"), // FK → orders.id (P2.4)
    props: jsonb("props"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("analytics_events_name_created_idx").on(t.name, t.createdAt),
    index("analytics_events_user_idx").on(t.userId),
    index("analytics_events_product_idx").on(t.productId),
    index("analytics_events_order_idx").on(t.orderId),
  ],
);

/** job_runs — one row per cron job per invocation; `status` null while running (docs/06 §3.3). */
export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    job: text("job").notNull(),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    status: jobStatus("status"),
    detail: jsonb("detail"),
  },
  (t) => [index("job_runs_job_started_idx").on(t.job, t.startedAt.desc())],
);

/** webhook_events — idempotency ledger for Resend and V1.1 gateway webhooks (docs/09 §B9). */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    receivedAt: ts("received_at").notNull().defaultNow(),
    processedAt: ts("processed_at"),
    payload: jsonb("payload").notNull(),
  },
  (t) => [
    uniqueIndex("webhook_events_provider_event_uq").on(t.provider, t.eventId),
    index("webhook_events_received_idx").on(t.receivedAt),
  ],
);

/** files_upload_intents — presigned-PUT intents; server-chosen `object_key` (docs/09 TM-12, API-CAT-21). */
export const filesUploadIntents = pgTable(
  "files_upload_intents",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Upload purpose selecting the MIME allow-list and size cap (docs/06 §3.5). */
    purpose: text("purpose").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    objectKey: text("object_key").notNull().unique(),
    consumed: boolean("consumed").notNull().default(false),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("files_upload_intents_user_idx").on(t.userId),
    index("files_upload_intents_expires_idx").on(t.consumed, t.expiresAt), // retention.purge_tokens
  ],
);

/** rate_limit_buckets — fixed-window counters keyed `class:subject` (docs/09 §7); purged by `daily`. */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStart: ts("window_start").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("rate_limit_buckets_expires_idx").on(t.expiresAt)],
);

export type DashboardLayout = typeof dashboardLayouts.$inferSelect;
export type NewDashboardLayout = typeof dashboardLayouts.$inferInsert;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
export type JobRun = typeof jobRuns.$inferSelect;
export type NewJobRun = typeof jobRuns.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type FilesUploadIntent = typeof filesUploadIntents.$inferSelect;
export type NewFilesUploadIntent = typeof filesUploadIntents.$inferInsert;
export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;
export type NewRateLimitBucket = typeof rateLimitBuckets.$inferInsert;
