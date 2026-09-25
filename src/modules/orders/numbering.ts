/** Order numbers: `CK-ORD-000001` from the `order_no_seq` sequence (docs/05 T-orders, docs/06 §1.9). */
import { sql } from "drizzle-orm";
import type { TxCtx } from "@/lib/db";
import { formatOrderNo } from "@/lib/ids";

/** Allocate the next order number inside `tx`. Sequences are never rolled back, so gaps are fine here. */
export async function nextOrderNo(tx: TxCtx): Promise<string> {
  const result = await tx.execute(sql`select nextval('order_no_seq') as seq`);
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as {
    seq: string | number;
  }[];
  const raw = rows[0]?.seq;
  if (raw === undefined) throw new Error("order_no_seq returned no value");
  const seq = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  return formatOrderNo(seq);
}
