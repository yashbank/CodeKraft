import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoiceSequences } from "../../../drizzle/schema/invoices";
import { computeFy, nextInvoiceNumber } from "@/modules/invoices/numbering";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";

describe("Financial Year Boundary handling (FI-09, BR-16)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("partitions sequences correctly between 31 Mar 23:59 IST and 1 Apr 00:00 IST", async () => {
    await truncateAll();

    // 31 Mar 2026 23:59:00 IST = 18:29:00 UTC
    const dateOldFy = new Date("2026-03-31T18:29:00.000Z");
    // 1 Apr 2026 00:00:00 IST = 18:30:00 UTC
    const dateNewFy = new Date("2026-03-31T18:30:00.000Z");

    const oldFy = computeFy(dateOldFy);
    const newFy = computeFy(dateNewFy);

    expect(oldFy).toBe("2025-26");
    expect(newFy).toBe("2026-27");

    // Allocate in old FY
    const oldAlloc1 = await db.transaction((tx) => nextInvoiceNumber(oldFy, tx));
    const oldAlloc2 = await db.transaction((tx) => nextInvoiceNumber(oldFy, tx));

    expect(oldAlloc1.number).toBe("CK/2025-26/0001");
    expect(oldAlloc2.number).toBe("CK/2025-26/0002");

    // Allocate in new FY - sequence resets to 0001
    const newAlloc1 = await db.transaction((tx) => nextInvoiceNumber(newFy, tx));
    expect(newAlloc1.number).toBe("CK/2026-27/0001");

    // Verify DB states for both FY rows
    const rows = await db.select().from(invoiceSequences);
    const oldRow = rows.find((r) => r.fy === "2025-26");
    const newRow = rows.find((r) => r.fy === "2026-27");

    expect(oldRow?.lastSeq).toBe(2);
    expect(newRow?.lastSeq).toBe(1);
  });
});
