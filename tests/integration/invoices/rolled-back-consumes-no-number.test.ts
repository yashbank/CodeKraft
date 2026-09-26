import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoiceSequences } from "../../../drizzle/schema/invoices";
import { nextInvoiceNumber } from "@/modules/invoices/numbering";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";

describe("Rolled back transaction consumes no number (BR-16)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("rolls back sequence counter when transaction aborts, leaving no sequence gaps", async () => {
    await truncateAll();

    const fy = "2026-27";

    // 1. Successful transaction allocating 0001
    const first = await db.transaction(async (tx) => {
      return await nextInvoiceNumber(fy, tx);
    });
    expect(first.seq).toBe(1);
    expect(first.number).toBe("CK/2026-27/0001");

    // 2. Aborted transaction
    await expect(
      db.transaction(async (tx) => {
        await nextInvoiceNumber(fy, tx);
        throw new Error("Simulated failure in transaction");
      })
    ).rejects.toThrow("Simulated failure in transaction");

    // Sequence in table should still be 1
    const [row] = await db
      .select()
      .from(invoiceSequences)
      .where(eq(invoiceSequences.fy, fy));
    expect(row?.lastSeq).toBe(1);

    // 3. Next transaction should obtain sequence 2, NOT 3
    const next = await db.transaction(async (tx) => {
      return await nextInvoiceNumber(fy, tx);
    });
    expect(next.seq).toBe(2);
    expect(next.number).toBe("CK/2026-27/0002");
  });
});
