import { beforeAll, describe, expect, it } from "vitest";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoicesService } from "@/modules/invoices/service";
import { invoices } from "../../../drizzle/schema/invoices";
import { media } from "../../../drizzle/schema/media";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { ordersService } from "@/modules/orders/service";
import { nextInvoiceNumber } from "@/modules/invoices/numbering";
import { buildContext } from "@/lib/authz/context";

describe("Invoice PDF regenerate pending integration (docs/12 §11.3)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("finds invoices with null pdfMediaId and generates PDFs for them", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partner = await createPartner({ userId: admin.id });
    const customer = await createUser({ emailVerified: true });
    const product = await createProduct({ createdBy: admin.id });

    await createOwnership({
      productId: product.id,
      version: 1,
      status: "active",
      companyCutBps: 1000,
      createdBy: admin.id,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    const offering = await createOffering({
      productId: product.id,
      price: { amountMinor: 5000, currency: "INR" },
    });

    const custCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust" },
      roles: ["user"],
    });

    const orderRes = await ordersService.createOrder(custCtx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: { name: "Customer Bob", email: customer.email, country: "IN" },
    });

    // Manually insert an invoice with pdfMediaId: null
    const fy = "2026-27";
    const seqAlloc = await db.transaction((tx) => nextInvoiceNumber(fy, tx));

    const [insertedInvoice] = await db
      .insert(invoices)
      .values({
        invoiceNo: seqAlloc.number,
        orderId: orderRes.orderId,
        fy,
        seq: seqAlloc.seq,
        issuedAt: new Date(),
        sellerSnapshot: {
          name: "CodeKraft",
          address: "Bangalore",
        },
        buyerSnapshot: {
          name: "Customer Bob",
          email: customer.email,
          country: "IN",
        },
        lines: [
          {
            description: "Test product",
            quantity: 1,
            unit_minor: 5000,
            discount_minor: 0,
            tax_minor: 0,
            total_minor: 5000,
          },
        ],
        subtotalMinor: 5000,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: 5000,
        currency: "INR",
        pdfMediaId: null,
      })
      .returning();

    expect(insertedInvoice!.pdfMediaId).toBeNull();

    // Verify it is currently pending
    const pendingBefore = await db
      .select()
      .from(invoices)
      .where(isNull(invoices.pdfMediaId));
    expect(pendingBefore).toHaveLength(1);

    // Run regeneratePending
    const res = await invoicesService.regeneratePending();
    expect(res.count).toBe(1);

    // Verify it is no longer pending
    const pendingAfter = await db
      .select()
      .from(invoices)
      .where(isNull(invoices.pdfMediaId));
    expect(pendingAfter).toHaveLength(0);

    // Verify invoice row now has pdfMediaId set
    const [updatedInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, insertedInvoice!.id));
    expect(updatedInvoice?.pdfMediaId).not.toBeNull();

    // Verify media record exists
    const [mediaRow] = await db
      .select()
      .from(media)
      .where(eq(media.id, updatedInvoice!.pdfMediaId!));
    expect(mediaRow).toBeDefined();
    expect(mediaRow?.mime).toBe("application/pdf");
  });
});
