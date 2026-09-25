/**
 * Invoices and credit notes (docs/05 §5 T-invoices). Numbering is gapless per financial year:
 * the issuing transaction row-locks `invoice_sequences` / `credit_note_sequences` with
 * `SELECT … FOR UPDATE` (BR-16, §12). All four tables are immutable — the append-only trigger
 * lives in drizzle/custom (P2.4).
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  char,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { orders, refunds } from "./commerce";
import { media } from "./media";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const money = (name: string) => bigint(name, { mode: "number" });

/** Seller identity frozen on the invoice (site_settings at issue time). */
export interface SellerSnapshot {
  name: string;
  address: string;
  gst_number?: string | null;
  pan?: string | null;
  email?: string | null;
  phone?: string | null;
  state_code?: string | null;
  [key: string]: unknown;
}

/** Buyer identity frozen on the invoice (orders.billing_snapshot at issue time). */
export interface BuyerSnapshot {
  name: string;
  email: string;
  country: string;
  company?: string | null;
  address?: string | null;
  gst_number?: string | null;
  state_code?: string | null;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unit_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  hsn_sac?: string | null;
}

/** cgst/sgst or igst split in minor units (null for non-GST invoices). */
export interface GstBreakdown {
  cgst_minor?: number;
  sgst_minor?: number;
  igst_minor?: number;
  rate_bps: number;
}

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** CK/2026-27/0001 */
    invoiceNo: text("invoice_no").notNull().unique(),
    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => orders.id),
    /** Financial year label, e.g. '2026-27'. */
    fy: text("fy").notNull(),
    seq: integer("seq").notNull(),
    issuedAt: ts("issued_at").notNull().defaultNow(),
    sellerSnapshot: jsonb("seller_snapshot").$type<SellerSnapshot>().notNull(),
    buyerSnapshot: jsonb("buyer_snapshot").$type<BuyerSnapshot>().notNull(),
    lines: jsonb("lines").$type<InvoiceLine[]>().notNull(),
    subtotalMinor: money("subtotal_minor").notNull(),
    discountMinor: money("discount_minor").notNull().default(0),
    taxMinor: money("tax_minor").notNull().default(0),
    totalMinor: money("total_minor").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    gstBreakdown: jsonb("gst_breakdown").$type<GstBreakdown>(),
    /**
     * Rendered PDF; nullable because webhook-driven confirmations defer rendering (docs/06 §3).
     * `restrict`: the row is append-only, so a `set null` cascade would be rejected anyway.
     */
    pdfMediaId: uuid("pdf_media_id").references(() => media.id, { onDelete: "restrict" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("invoices_fy_seq_idx").on(t.fy, t.seq),
    index("invoices_issued_at_idx").on(t.issuedAt),
    index("invoices_pdf_media_idx").on(t.pdfMediaId),
  ],
);

/** Row-locked on issue (BR-16). */
export const invoiceSequences = pgTable("invoice_sequences", {
  fy: text("fy").primaryKey(),
  lastSeq: integer("last_seq").notNull().default(0),
});

export const creditNotes = pgTable(
  "credit_notes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** CK/CN/2026-27/0001 */
    creditNo: text("credit_no").notNull().unique(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    refundId: uuid("refund_id")
      .notNull()
      .references((): AnyPgColumn => refunds.id),
    fy: text("fy").notNull(),
    seq: integer("seq").notNull(),
    amountMinor: money("amount_minor").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    issuedAt: ts("issued_at").notNull().defaultNow(),
    pdfMediaId: uuid("pdf_media_id").references(() => media.id, { onDelete: "restrict" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("credit_notes_invoice_idx").on(t.invoiceId),
    index("credit_notes_refund_idx").on(t.refundId),
    index("credit_notes_fy_seq_idx").on(t.fy, t.seq),
    index("credit_notes_pdf_media_idx").on(t.pdfMediaId),
  ],
);

/** Gapless like invoices. */
export const creditNoteSequences = pgTable("credit_note_sequences", {
  fy: text("fy").primaryKey(),
  lastSeq: integer("last_seq").notNull().default(0),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceSequence = typeof invoiceSequences.$inferSelect;
export type CreditNote = typeof creditNotes.$inferSelect;
export type NewCreditNote = typeof creditNotes.$inferInsert;
export type CreditNoteSequence = typeof creditNoteSequences.$inferSelect;
