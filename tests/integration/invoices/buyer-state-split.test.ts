import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { invoicesService } from "@/modules/invoices/service";
import { invoices } from "../../../drizzle/schema/invoices";
import { siteSettings } from "../../../drizzle/schema/settings";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createOrder } from "../../factories/commerce";
import { createUser } from "../../factories/users";
import { createOffering } from "../../factories/offerings";

// Seller GSTIN prefix 29 = Karnataka.
async function invoiceFor(billing: Record<string, string | null>) {
  const user = await createUser({ emailVerified: true });
  const offering = await createOffering({});
  const order = await createOrder({
    user,
    offering,
    status: "paid",
    taxRateBps: 1800,
    billingSnapshot: { name: "B", email: user.email, country: "IN", ...billing },
  });
  await withTx((tx) => invoicesService.issueInvoice({ orderId: order.id }, { userId: null }, tx));
  const [inv] = await db.select().from(invoices).where(eq(invoices.orderId, order.id));
  return { inv: inv!, order };
}

describe("invoice GST split from the buyer state (D17-05)", () => {
  beforeAll(async () => {
    await migrateTestDb();
    await truncateAll();
    await db
      .insert(siteSettings)
      .values([{ key: "gstin", value: "29ABCDE1234F1Z5" }] as never)
      .onConflictDoNothing();
  });

  it("no GSTIN, same state: CGST + SGST; totals unchanged", async () => {
    const { inv, order } = await invoiceFor({ state_code: "29" });
    expect(inv.gstBreakdown?.cgst_minor).toBeGreaterThan(0);
    expect(inv.gstBreakdown?.igst_minor).toBeUndefined();
    expect(inv.buyerSnapshot.state_code).toBe("29");
    expect(inv.totalMinor).toBe(order.totalMinor);
  });

  it("no GSTIN, other state: IGST", async () => {
    const { inv } = await invoiceFor({ state_code: "27" });
    expect(inv.gstBreakdown?.igst_minor).toBeGreaterThan(0);
  });

  it("the GSTIN prefix beats the picked state", async () => {
    const { inv } = await invoiceFor({ state_code: "29", gst_number: "27AAAAA0000A1Z5" });
    expect(inv.buyerSnapshot.state_code).toBe("27");
    expect(inv.gstBreakdown?.igst_minor).toBeGreaterThan(0);
  });

  it("an old snapshot with no state still gives IGST", async () => {
    const { inv } = await invoiceFor({});
    expect(inv.buyerSnapshot.state_code).toBeNull();
    expect(inv.gstBreakdown?.igst_minor).toBeGreaterThan(0);
  });
});
