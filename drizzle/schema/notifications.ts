/**
 * Notifications & email outbox (docs/05 §11). In-app is the primary channel (D-707); email is queued
 * through `email_outbox` and retried by cron `email.outbox_retry` with back-off (max 5 attempts).
 * `priority` orders sends under the Resend daily cap (docs/12 §Email): lower = sooner, default 5;
 * non-urgent mail (digests, reminders) is deferred once the daily counter reaches 90.
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const emailStatus = pgEnum("email_status", ["queued", "sent", "failed"]);

/** Per-channel delivery state stored on a notification, e.g. `{ inapp: 'sent', email: 'queued' }`. */
export type NotificationChannelState = {
  inapp?: "sent" | "read";
  email?: "queued" | "sent" | "failed" | "delivered" | "bounced" | "complained" | "skipped";
};

/** notifications — in-app inbox rows. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Event key, e.g. `payment.submitted`, `subscription.reminder` (docs/06 `N:` column). */
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    payload: jsonb("payload"),
    channelState: jsonb("channel_state")
      .$type<NotificationChannelState>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_read_created_idx").on(t.userId, t.readAt, t.createdAt.desc())],
);

/** email_outbox — transactional email queue (Resend). */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    toEmail: text("to_email").notNull(),
    /** React Email template key (docs/06 `E:` column). */
    template: text("template").notNull(),
    payload: jsonb("payload")
      .notNull()
      .default(sql`'{}'::jsonb`),
    priority: smallint("priority").notNull().default(5),
    status: emailStatus("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: ts("sent_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("email_outbox_status_priority_created_idx").on(t.status, t.priority, t.createdAt),
    index("email_outbox_sent_at_idx").on(t.sentAt), // daily-cap counter
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type EmailOutboxRow = typeof emailOutbox.$inferSelect;
export type NewEmailOutboxRow = typeof emailOutbox.$inferInsert;
