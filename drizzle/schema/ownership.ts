/**
 * Ownership (docs/05 §4): effective-dated, dual-approved partner splits per product.
 *  - one active version per product → partial unique index (docs/05 §12)
 *  - Σ share_bps = 10000 per ownership → deferred constraint trigger `ownership_lines_sum` (P2.4, BR-06/BR-07)
 */
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { approvalRequests } from "./approvals";
import { users } from "./auth";
import { products } from "./catalog";
import { partners } from "./users-ext";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const ownershipStatus = pgEnum("ownership_status", ["pending", "active", "superseded"]);

/** T-product_ownerships */
export const productOwnerships = pgTable(
  "product_ownerships",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    companyCutBps: integer("company_cut_bps").notNull().default(0),
    status: ownershipStatus("status").notNull().default("pending"),
    effectiveFrom: ts("effective_from"),
    /** The `ownership.change` request that activated this version (docs/05 §4); history → restrict. */
    approvalRequestId: uuid("approval_request_id").references(() => approvalRequests.id, {
      onDelete: "restrict",
    }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("product_ownerships_product_version_unique").on(t.productId, t.version),
    uniqueIndex("product_ownerships_one_active_idx")
      .on(t.productId)
      .where(sql`${t.status} = 'active'`),
    index("product_ownerships_approval_request_idx").on(t.approvalRequestId),
    check(
      "product_ownerships_company_cut_bps_range",
      sql`${t.companyCutBps} >= 0 AND ${t.companyCutBps} <= 10000`,
    ),
  ],
);

/** T-product_ownership_lines — 100 % to a single partner is allowed (BR-07). */
export const productOwnershipLines = pgTable(
  "product_ownership_lines",
  {
    ownershipId: uuid("ownership_id")
      .notNull()
      .references(() => productOwnerships.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict" }),
    shareBps: integer("share_bps").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.ownershipId, t.partnerId] }),
    index("product_ownership_lines_partner_idx").on(t.partnerId),
    check(
      "product_ownership_lines_share_bps_range",
      sql`${t.shareBps} > 0 AND ${t.shareBps} <= 10000`,
    ),
  ],
);

export type ProductOwnership = typeof productOwnerships.$inferSelect;
export type NewProductOwnership = typeof productOwnerships.$inferInsert;
export type ProductOwnershipLine = typeof productOwnershipLines.$inferSelect;
export type NewProductOwnershipLine = typeof productOwnershipLines.$inferInsert;
