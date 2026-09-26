/**
 * Invoice and credit note gapless FY numbering (BR-16, FI-08, FI-09, docs/05 §5, docs/06 §2.3).
 */
import { eq } from "drizzle-orm";
import type { TxCtx } from "@/lib/db";
import { invoiceSequences, creditNoteSequences } from "../../../drizzle/schema/invoices";
import type { SequenceAllocation } from "./types";

/**
 * Computes Indian Financial Year (1 April - 31 March) in Asia/Kolkata timezone (UTC+5:30).
 * E.g., 31 Mar 2026 -> '2025-26', 1 Apr 2026 -> '2026-27'.
 */
export function computeFy(date: Date = new Date()): string {
  // Asia/Kolkata is UTC + 5 hours 30 minutes
  const kolkataOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istDate = new Date(date.getTime() + kolkataOffsetMs);

  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth(); // 0 = Jan, 2 = Mar, 3 = Apr

  if (month >= 3) {
    // April (3) to December (11): FY is Year - (Year + 1)
    const nextYearShort = String((year + 1) % 100).padStart(2, "0");
    return `${year}-${nextYearShort}`;
  } else {
    // January (0) to March (2): FY is (Year - 1) - Year
    const curYearShort = String(year % 100).padStart(2, "0");
    return `${year - 1}-${curYearShort}`;
  }
}

/**
 * Atomically allocates the next invoice number for an FY using `SELECT ... FOR UPDATE` (BR-16).
 * Format: `CK/<fy>/<seq 4+ digits>` (e.g. `CK/2026-27/0001`).
 */
export async function nextInvoiceNumber(fy: string, tx: TxCtx): Promise<SequenceAllocation> {
  // Ensure the sequence row exists
  await tx
    .insert(invoiceSequences)
    .values({ fy, lastSeq: 0 })
    .onConflictDoNothing();

  const [row] = await tx
    .select({ lastSeq: invoiceSequences.lastSeq })
    .from(invoiceSequences)
    .where(eq(invoiceSequences.fy, fy))
    .for("update");

  const nextSeq = (row?.lastSeq ?? 0) + 1;

  await tx
    .update(invoiceSequences)
    .set({ lastSeq: nextSeq })
    .where(eq(invoiceSequences.fy, fy));

  const seqStr = String(nextSeq).padStart(4, "0");
  const number = `CK/${fy}/${seqStr}`;

  return { fy, seq: nextSeq, number };
}

/**
 * Atomically allocates the next credit note number for an FY using `SELECT ... FOR UPDATE` (BR-16).
 * Format: `CK/CN/<fy>/<seq 4+ digits>` (e.g. `CK/CN/2026-27/0001`).
 */
export async function nextCreditNoteNumber(fy: string, tx: TxCtx): Promise<SequenceAllocation> {
  await tx
    .insert(creditNoteSequences)
    .values({ fy, lastSeq: 0 })
    .onConflictDoNothing();

  const [row] = await tx
    .select({ lastSeq: creditNoteSequences.lastSeq })
    .from(creditNoteSequences)
    .where(eq(creditNoteSequences.fy, fy))
    .for("update");

  const nextSeq = (row?.lastSeq ?? 0) + 1;

  await tx
    .update(creditNoteSequences)
    .set({ lastSeq: nextSeq })
    .where(eq(creditNoteSequences.fy, fy));

  const seqStr = String(nextSeq).padStart(4, "0");
  const number = `CK/CN/${fy}/${seqStr}`;

  return { fy, seq: nextSeq, number };
}
