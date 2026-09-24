/**
 * Identifiers — docs/06 §1.9. Internal ids are UUID v4 and never appear in public URLs;
 * public numbers are `CK-ORD-000001`, `CK/2026-27/0001`, `CK/CN/2026-27/0001` (BR-16, gapless per FY).
 */
import { randomBytes, randomUUID } from "node:crypto";

const FY_RE = /^\d{4}-\d{2}$/;

function assertSeq(seq: number, what: string): void {
  if (!Number.isSafeInteger(seq) || seq < 1) {
    throw new RangeError(`${what} sequence must be a positive integer, got ${String(seq)}`);
  }
}

function assertFy(fy: string): void {
  if (!FY_RE.test(fy)) throw new RangeError(`financial year must look like 2026-27, got ${fy}`);
}

export function newId(): string {
  return randomUUID();
}

/** `CK-ORD-000001`; the width grows past 999 999 rather than truncating. */
export function formatOrderNo(seq: number): string {
  assertSeq(seq, "order");
  return `CK-ORD-${String(seq).padStart(6, "0")}`;
}

/** `CK/2026-27/0001` (BR-16). */
export function formatInvoiceNo(fy: string, seq: number): string {
  assertFy(fy);
  assertSeq(seq, "invoice");
  return `CK/${fy}/${String(seq).padStart(4, "0")}`;
}

/** `CK/CN/2026-27/0001`. */
export function formatCreditNoteNo(fy: string, seq: number): string {
  assertFy(fy);
  assertSeq(seq, "credit note");
  return `CK/CN/${fy}/${String(seq).padStart(4, "0")}`;
}

/** Random opaque token, base64url (no padding). Default 32 bytes = 256 bits (docs/09 §5.2 ≥ 128). */
export function randomToken(bytes = 32): string {
  if (!Number.isInteger(bytes) || bytes < 16) throw new RangeError("token needs at least 16 bytes");
  return randomBytes(bytes).toString("base64url");
}
