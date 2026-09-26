import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotesService } from "@/modules/quotes/service";
import { quoteExpiryJob } from "@/jobs/quote-expiry";
import { customQuotes, orders } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { buildContext } from "@/lib/authz/context";

describe("Quote keeps negotiated order price and stays accepted after expiry (API-COM-10, BR-10)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("leaves quote in accepted status if an order was created, preserving negotiated price", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });

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

    // Create quote with future expiry
    const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
    const quoteRes = await quotesService.createCustomQuote(adminCtx, {
      customerId: customer.id,
      title: "Negotiated Retainer",
      currency: "INR",
      amountMinor: 40000,
      expiresAt: futureDate,
    });

    await quotesService.sendCustomQuote(adminCtx, { quoteId: quoteRes.quoteId });

    // Accept quote before expiry
    const acceptRes = await quotesService.acceptCustomQuote(custCtx, {
      token: quoteRes.token,
      paymentMethod: "manual_upi",
      billing: {
        name: "Acme Client",
        email: customer.email,
        country: "IN",
      },
    });

    expect(acceptRes.orderId).toBeDefined();

    // Now advance time past expiry date
    const laterTime = new Date(Date.now() + 7200 * 1000);
    const jobRes = await quoteExpiryJob.run(laterTime);

    // Job should NOT expire this quote because order exists
    expect(jobRes.expiredQuoteIds).not.toContain(quoteRes.quoteId);

    // Verify quote in DB is still 'accepted'
    const [quote] = await db
      .select()
      .from(customQuotes)
      .where(eq(customQuotes.id, quoteRes.quoteId));
    expect(quote?.status).toBe("accepted");
    expect(quote?.orderId).toBe(acceptRes.orderId);

    // Verify order in DB preserves original negotiated price
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, acceptRes.orderId));
    expect(order?.totalMinor).toBe(40000);
  });
});
