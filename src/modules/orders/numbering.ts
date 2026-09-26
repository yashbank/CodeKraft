/**
 * Order numbering: CK-ORD-nnnnnn from order_no_seq (docs/06 §2.3, BR-16).
 */
import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";

export async function nextOrderNo(tx: DbOrTx): Promise<string> {
  const result = await tx.execute<{ order_no: string }>(
    sql`SELECT 'CK-ORD-' || lpad(nextval('order_no_seq')::text, 6, '0') AS order_no`,
  );
  const row = (result as unknown as { rows: { order_no: string }[] }).rows?.[0] ?? (result as unknown as { order_no: string }[])[0];
  if (!row?.order_no) {
    throw new Error("Failed to generate order number from sequence order_no_seq");
  }
  return row.order_no;
}
