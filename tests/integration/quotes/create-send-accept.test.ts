import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotesService } from "@/modules/quotes/service";
import { paymentsService } from "@/modules/payments/service";
import { customQuotes, orders, orderItems } from "../../../drizzle/schema/commerce";
import { notifications, emailOutbox } from "../../../drizzle/schema/notifications";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOwnership } from "../../factories/ownership";
import { buildContext } from "@/lib/authz/context";

describe("Custom Quotes create-send-accept integration (API-COM-09, API-COM-10)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("handles the complete lifecycle: create (draft) -> send (sent) -> accept (accepted) -> confirm (paid)", async () => {
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
      price: { amountMinor: 20000, currency: "INR" },
    });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    const custCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust" },
      roles: ["user"],
    });

    // 1. Create Custom Quote (Draft)
    const createRes = await quotesService.createCustomQuote(adminCtx, {
      customerId: customer.id,
      offeringId: offering.id,
      title: "Enterprise Custom License",
      description: "Negotiated enterprise volume license",
      currency: "INR",
      amountMinor: 15000, // Negotiated from 20000 to 15000
    });

    expect(createRes.quoteId).toBeDefined();
    expect(createRes.token).toBeDefined();
    expect(createRes.payUrl).toContain(createRes.token);

    const [draftQuote] = await db
      .select()
      .from(customQuotes)
      .where(eq(customQuotes.id, createRes.quoteId));
    expect(draftQuote?.status).toBe("draft");

    // 2. Send Custom Quote (Sent)
    const sendRes = await quotesService.sendCustomQuote(adminCtx, {
      quoteId: createRes.quoteId,
    });
    expect(sendRes.quote.status).toBe("sent");

    // Verify customer notification and email outbox
    const [notif] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, customer.id));
    expect(notif?.type).toBe("quote.sent");

    const [email] = await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.toEmail, customer.email));
    expect(email?.template).toBe("custom-quote");

    // 3. Customer accepts quote
    const acceptRes = await quotesService.acceptCustomQuote(custCtx, {
      token: createRes.token,
      paymentMethod: "manual_upi",
      billing: {
        name: "Enterprise Buyer",
        email: customer.email,
        country: "IN",
      },
    });

    expect(acceptRes.orderId).toBeDefined();
    expect(acceptRes.payment.paymentId).toBeDefined();

    // Verify order in database
    const [savedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, acceptRes.orderId));
    expect(savedOrder?.customQuoteId).toBe(createRes.quoteId);
    expect(savedOrder?.totalMinor).toBe(15000);

    const [savedItem] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, acceptRes.orderId));
    expect(savedItem?.unitMinor).toBe(15000);
    expect(savedItem?.description).toBe("Enterprise Custom License");

    // Verify quote is now 'accepted'
    const [acceptedQuote] = await db
      .select()
      .from(customQuotes)
      .where(eq(customQuotes.id, createRes.quoteId));
    expect(acceptedQuote?.status).toBe("accepted");
    expect(acceptedQuote?.orderId).toBe(acceptRes.orderId);

    // 4. Admin confirms payment -> Quote becomes 'paid'
    await paymentsService.confirmPayment(adminCtx, {
      paymentId: acceptRes.payment.paymentId,
      amountReceivedMinor: 15000,
      reference: "UTR-QUOTE-PAID-1",
      receivedOn: "2026-09-26",
    });

    const [paidQuote] = await db
      .select()
      .from(customQuotes)
      .where(eq(customQuotes.id, createRes.quoteId));
    expect(paidQuote?.status).toBe("paid");
  });
});
