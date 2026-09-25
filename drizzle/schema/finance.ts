/**
 * Finance ledger (docs/05 §7): append-only signed entries with FX to INR on every row (D-515,
 * BR-17), per-item allocation snapshots, payouts and expenses. `ledger_entries`, `allocations`
 * and `payouts` are immutable — triggers in drizzle/custom (P2.4); corrections are new
 * `adjustment` entries (MASTER_SPEC §4.1).
 *
 * Sign convention on `amount_minor` (used by the `partner_balances` view): amounts are signed
 * from the perspective of `party_type`. `partner_allocation` and `sale` are positive credits;
 * `refund_*`, `payout`, `expense`, `discount`, `gateway_fee`, `bank_charge` are negative.
 *
 * `partner_id` (→ partners), `allocations.ownership_id` (→ product_ownerships),
 * `expenses.product_id` (→ products) and `expenses.receipt_media_id` (→ media) are domain A
 * targets: plain `uuid` here, constraints added by the integrator. `fx_rates` is owned by
 * domain A (fx/settings), not this file.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { approvalRequests } from "./approvals";
import { users } from "./auth";
import { orderItems, orders, payments, refunds } from "./commerce";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const money = (name: string) => bigint(name, { mode: "number" });
const currency = (name = "currency") => char(name, { length: 3 });
const fxRate = (name: string) => numeric(name, { precision: 18, scale: 8 });

/** The fifteen entry types (docs/05 §7; refund scope per MASTER_SPEC §7 "Refund reversal scope"). */
export const entryType = pgEnum("entry_type", [
  "sale",
  "discount",
  "tax_collected",
  "gateway_fee",
  "bank_charge",
  "company_cut",
  "partner_allocation",
  "refund_sale",
  "refund_discount",
  "refund_tax",
  "refund_company_cut",
  "refund_partner_allocation",
  "payout",
  "expense",
  "adjustment",
]);

export const partyType = pgEnum("party_type", [
  "customer",
  "company",
  "partner",
  "tax_authority",
  "gateway",
  "bank",
]);

/** docs/05 T-allocations `lines` — one element per partner share, largest-remainder rounded. */
export interface AllocationLine {
  partner_id: string;
  share_bps: number;
  amount_minor: number;
}

// ---------------------------------------------------------------------------------------------
// Payouts (T-payouts) — recorded through an applied `payout.record` approval; immutable
// ---------------------------------------------------------------------------------------------

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id").notNull(), // FK → partners.id (P2.4)
    amountMinor: money("amount_minor").notNull(),
    currency: currency().notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    /** Bank / UPI transfer reference (1..120 chars, API-FIN-04). */
    reference: text("reference").notNull(),
    note: text("note"),
    approvalRequestId: uuid("approval_request_id").references(() => approvalRequests.id),
    recordedBy: uuid("recorded_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("payouts_partner_idx").on(t.partnerId, t.paidOn),
    index("payouts_approval_idx").on(t.approvalRequestId),
    index("payouts_recorded_by_idx").on(t.recordedBy),
  ],
);

// ---------------------------------------------------------------------------------------------
// Expenses (T-expenses, D-514) — posts `expense` entries shared by the product's split
// ---------------------------------------------------------------------------------------------

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** Null = company-level expense (not shared with partners). */
    productId: uuid("product_id"), // FK → products.id (P2.4)
    category: text("category").notNull(),
    description: text("description"),
    amountMinor: money("amount_minor").notNull(),
    currency: currency().notNull(),
    incurredOn: date("incurred_on", { mode: "string" }).notNull(),
    /** When true the expense is split across the product's active ownership lines. */
    sharedBySplit: boolean("shared_by_split").notNull().default(true),
    receiptMediaId: uuid("receipt_media_id"), // FK → media.id (P2.4)
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("expenses_product_idx").on(t.productId, t.incurredOn),
    index("expenses_incurred_on_idx").on(t.incurredOn),
    index("expenses_receipt_media_idx").on(t.receiptMediaId),
    index("expenses_created_by_idx").on(t.createdBy),
  ],
);

// ---------------------------------------------------------------------------------------------
// Ledger entries (T-ledger_entries) — append-only
// ---------------------------------------------------------------------------------------------

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** Monotonic posting order for reports and reconciliation. */
    seq: bigserial("seq", { mode: "number" }).notNull().unique(),
    entryType: entryType("entry_type").notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    orderItemId: uuid("order_item_id").references(() => orderItems.id),
    paymentId: uuid("payment_id").references(() => payments.id),
    refundId: uuid("refund_id").references(() => refunds.id),
    payoutId: uuid("payout_id").references(() => payouts.id),
    expenseId: uuid("expense_id").references(() => expenses.id),
    partyType: partyType("party_type").notNull(),
    partnerId: uuid("partner_id"), // FK → partners.id (P2.4); set when party_type = 'partner'
    /** Signed, minor units, in `currency`. */
    amountMinor: money("amount_minor").notNull(),
    currency: currency().notNull(),
    /** Rate applied on this entry (D-515); INR entries carry 1.00000000. */
    fxRateToInr: fxRate("fx_rate_to_inr").notNull(),
    /** amount_minor × fx_rate_to_inr rounded to paise — the reporting column (API-FIN-09). */
    amountInrMinor: money("amount_inr_minor").notNull(),
    memo: text("memo"),
    /** Set for `adjustment` entries (ledger.adjustment approval, API-FIN-08). */
    approvalRequestId: uuid("approval_request_id").references(() => approvalRequests.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ledger_entries_partner_created_idx").on(t.partnerId, t.createdAt),
    index("ledger_entries_order_idx").on(t.orderId),
    index("ledger_entries_order_item_idx").on(t.orderItemId),
    index("ledger_entries_payment_idx").on(t.paymentId),
    index("ledger_entries_refund_idx").on(t.refundId),
    index("ledger_entries_payout_idx").on(t.payoutId),
    index("ledger_entries_expense_idx").on(t.expenseId),
    index("ledger_entries_approval_idx").on(t.approvalRequestId),
    index("ledger_entries_type_created_idx").on(t.entryType, t.createdAt),
    index("ledger_entries_created_by_idx").on(t.createdBy),
  ],
);

// ---------------------------------------------------------------------------------------------
// Allocations (T-allocations) — per-item snapshot, derivable from entries; immutable
// ---------------------------------------------------------------------------------------------

export const allocations = pgTable(
  "allocations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id),
    /** Null for project lines (split comes from `order_items.split_snapshot`). */
    ownershipId: uuid("ownership_id"), // FK → product_ownerships.id (P2.4)
    companyCutBps: integer("company_cut_bps").notNull(),
    /** gross − discount − tax − gateway fee − bank shortfall for this item (docs/06 §4.2). */
    distributableMinor: money("distributable_minor").notNull(),
    companyMinor: money("company_minor").notNull(),
    lines: jsonb("lines").$type<AllocationLine[]>().notNull(),
    currency: currency().notNull(),
    amountInrMinor: money("amount_inr_minor").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("allocations_order_item_idx").on(t.orderItemId),
    index("allocations_ownership_idx").on(t.ownershipId),
  ],
);

export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type NewLedgerEntry = typeof ledgerEntries.$inferInsert;
export type Allocation = typeof allocations.$inferSelect;
export type NewAllocation = typeof allocations.$inferInsert;
export type Payout = typeof payouts.$inferSelect;
export type NewPayout = typeof payouts.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type EntryType = (typeof entryType.enumValues)[number];
export type PartyType = (typeof partyType.enumValues)[number];
