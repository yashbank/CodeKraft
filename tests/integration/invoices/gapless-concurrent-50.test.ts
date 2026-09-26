import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoiceSequences } from "../../../drizzle/schema/invoices";
import { nextInvoiceNumber } from "@/modules/invoices/numbering";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";

describe("Gapless FY numbering 50 concurrent transactions (FI-08, BR-16)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("allocates sequences 1..50 with zero gaps and zero duplicates under 50 concurrent txs", async () => {
    await truncateAll();

    const fy = "2026-27";
    const concurrency = 50;

    const allocations = await Promise.all(
      Array.from({ length: concurrency }, () =>
        db.transaction(async (tx) => {
          return await nextInvoiceNumber(fy, tx);
        })
      )
    );

    expect(allocations).toHaveLength(concurrency);

    const seqs = allocations.map((a) => a.seq).sort((a, b) => a - b);
    const numbers = new Set(allocations.map((a) => a.number));

    // Zero duplicates
    expect(numbers.size).toBe(concurrency);

    // Continuous 1..50 with zero gaps
    for (let i = 0; i < concurrency; i++) {
      expect(seqs[i]).toBe(i + 1);
      const expectedPadded = String(i + 1).padStart(4, "0");
      expect(allocations.some((a) => a.number === `CK/${fy}/${expectedPadded}`)).toBe(true);
    }

    // Verify persisted sequence in DB
    const [row] = await db
      .select()
      .from(invoiceSequences)
      .where(eq(invoiceSequences.fy, fy));
    expect(row?.lastSeq).toBe(concurrency);
  });
});
