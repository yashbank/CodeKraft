import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoicesService } from "@/modules/invoices/service";
import { invoices } from "../../../drizzle/schema/invoices";
import { media } from "../../../drizzle/schema/media";
import { getDocumentsBucketName, getStorageDriver } from "@/lib/storage";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { ordersService } from "@/modules/orders/service";
import { paymentsService } from "@/modules/payments/service";
import { buildContext } from "@/lib/authz/context";

describe("Invoice PDF to storage integration (D-1502, BR-16)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("generates valid %PDF-1.4, stores to codekraft-documents, and links media row", async () => {
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

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    const orderRes = await ordersService.createOrder(custCtx, {
      offeringId: offering.id,
      paymentMethod: "manual_upi",
      billing: { name: "Customer Bob", email: customer.email, country: "IN" },
    });

    // Confirm payment which issues invoice
    const confirmRes = await paymentsService.confirmPayment(adminCtx, {
      paymentId: orderRes.payment.paymentId,
      amountReceivedMinor: 5000,
      reference: "UTR-PDF-STORE-1",
      receivedOn: "2026-09-26",
    });

    expect(confirmRes.invoiceId).toBeDefined();

    // Now render the PDF
    const renderRes = await db.transaction(async (tx) => {
      return await invoicesService.renderInvoicePdf(confirmRes.invoiceId!, tx);
    });

    expect(renderRes.pdfMediaId).toBeDefined();

    // Verify invoice row has pdfMediaId linked
    const [inv] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, confirmRes.invoiceId!));
    expect(inv?.pdfMediaId).toBe(renderRes.pdfMediaId);

    // Verify media table row
    const [mediaRow] = await db
      .select()
      .from(media)
      .where(eq(media.id, renderRes.pdfMediaId));
    expect(mediaRow).toBeDefined();
    expect(mediaRow?.bucket).toBe(getDocumentsBucketName());
    expect(mediaRow?.mime).toBe("application/pdf");
    expect(mediaRow?.visibility).toBe("private");

    // Verify object content in storage driver
    const driver = getStorageDriver();
    const storedBuf = await driver.getObjectRange(mediaRow!.bucket, mediaRow!.objectKey, 0, 4);
    expect(storedBuf.toString("utf-8")).toBe("%PDF-");
  });
});
