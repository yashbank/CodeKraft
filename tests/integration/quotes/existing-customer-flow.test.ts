import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotesService } from "@/modules/quotes/service";
import { quoteExpiryJob } from "@/jobs/quote-expiry";
import { AppError, ErrorCode } from "@/lib/errors";
import { customQuotes, orders, orderItems } from "../../../drizzle/schema/commerce";
import { notifications, emailOutbox } from "../../../drizzle/schema/notifications";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { buildContext } from "@/lib/authz/context";

const day = 24 * 3600 * 1000;
const billing = (email: string) => ({ name: "Existing Customer", email, country: "IN" });

async function setup() {
  await truncateAll();
  const admin = await createAdmin();
  const customer = await createUser({ emailVerified: true, name: "Priya Existing" });
  const adminCtx = buildContext({
    user: { id: admin.id },
    session: { id: "s-admin" },
    roles: ["admin"],
  });
  const custCtx = buildContext({
    user: { id: customer.id },
    session: { id: "s-cust" },
    roles: ["user"],
  });
  return { admin, customer, adminCtx, custCtx };
}

describe("Custom quote to an existing customer (admin send -> customer accept/reject)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("finds the existing customer by name/email, sends, notifies + emails, customer sees it and accepts with tax + line items", async () => {
    const { customer, adminCtx, custCtx } = await setup();

    const byName = await quotesService.searchCustomers(adminCtx, { q: "priya" });
    expect(byName.map((c) => c.id)).toContain(customer.id);
    const byEmail = await quotesService.searchCustomers(adminCtx, { q: customer.email });
    expect(byEmail.map((c) => c.id)).toContain(customer.id);

    const created = await quotesService.createCustomQuote(adminCtx, {
      customerId: customer.id,
      title: "Dashboard build",
      currency: "INR",
      lineItems: [
        { description: "Design", quantity: 2, unitMinor: 10000 },
        { description: "Build", quantity: 1, unitMinor: 30000 },
      ],
      taxBps: 1800,
      internalNote: "call back Friday",
      expiresAt: new Date(Date.now() + 7 * day).toISOString(),
    });

    // Draft is invisible to the customer's Account > Quotes.
    expect(await quotesService.listMyQuotes(custCtx)).toHaveLength(0);

    const sent = await quotesService.sendCustomQuote(adminCtx, { quoteId: created.quoteId });
    expect(sent.quote.status).toBe("sent");
    expect(sent.quote.sentAt).toBeInstanceOf(Date);
    expect(sent.quote.amountMinor).toBe(50000);

    const [notif] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, customer.id), eq(notifications.type, "quote.sent")));
    expect(notif?.link).toBe(`/quote/${created.token}`);
    const [mail] = await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.toEmail, customer.email));
    expect(mail?.template).toBe("custom-quote");
    expect(mail?.payload).toMatchObject({ amount: "590.00", payUrl: created.payUrl });

    const mine = await quotesService.listMyQuotes(custCtx);
    expect(mine.map((q) => q.id)).toEqual([created.quoteId]);

    // Opening the link flips sent -> viewed (admin sees it).
    const view = await quotesService.getQuote(custCtx, { token: created.token });
    expect(view.canAccept).toBe(true);
    const [viewed] = await db
      .select()
      .from(customQuotes)
      .where(eq(customQuotes.id, created.quoteId));
    expect(viewed?.status).toBe("viewed");
    expect(viewed?.viewedAt).toBeInstanceOf(Date);

    const accepted = await quotesService.acceptCustomQuote(custCtx, {
      token: created.token,
      paymentMethod: "manual_upi",
      billing: billing(customer.email),
    });
    const [order] = await db.select().from(orders).where(eq(orders.id, accepted.orderId));
    expect(order?.subtotalMinor).toBe(50000);
    expect(order?.taxMinor).toBe(9000);
    expect(order?.totalMinor).toBe(59000);
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order!.id));
    expect(items).toHaveLength(2);
    expect(items.reduce((n, i) => n + Number(i.totalMinor), 0)).toBe(59000);
    const [done] = await db.select().from(customQuotes).where(eq(customQuotes.id, created.quoteId));
    expect(done?.status).toBe("accepted");
    expect(done?.acceptedAt).toBeInstanceOf(Date);
  });

  it("customer can reject; rejected quote cannot be accepted or cancelled", async () => {
    const { customer, adminCtx, custCtx } = await setup();
    const q = await quotesService.createCustomQuote(adminCtx, {
      customerId: customer.id,
      title: "Reject me",
      currency: "INR",
      amountMinor: 10000,
    });
    await quotesService.sendCustomQuote(adminCtx, { quoteId: q.quoteId });

    const stranger = await createUser({ emailVerified: true });
    const strangerCtx = buildContext({
      user: { id: stranger.id },
      session: { id: "s-x" },
      roles: ["user"],
    });
    await expect(
      quotesService.rejectCustomQuote(strangerCtx, { token: q.token }),
    ).rejects.toSatisfy((e) => e instanceof AppError && e.code === ErrorCode.FORBIDDEN);

    const res = await quotesService.rejectCustomQuote(custCtx, { token: q.token });
    expect(res.quote.status).toBe("rejected");
    expect(res.quote.rejectedAt).toBeInstanceOf(Date);

    await expect(
      quotesService.acceptCustomQuote(custCtx, {
        token: q.token,
        paymentMethod: "manual_upi",
        billing: billing(customer.email),
      }),
    ).rejects.toSatisfy((e) => e instanceof AppError && e.code === ErrorCode.STATE_INVALID);
    await expect(
      quotesService.cancelCustomQuote(adminCtx, { quoteId: q.quoteId }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("resend re-notifies and keeps the token; expired quotes need a new validity date", async () => {
    const { customer, adminCtx, custCtx } = await setup();
    const q = await quotesService.createCustomQuote(adminCtx, {
      customerId: customer.id,
      title: "Resend me",
      currency: "INR",
      amountMinor: 10000,
      expiresAt: new Date(Date.now() + 2 * day).toISOString(),
    });
    await quotesService.sendCustomQuote(adminCtx, { quoteId: q.quoteId });
    const again = await quotesService.sendCustomQuote(adminCtx, { quoteId: q.quoteId });
    expect(again.quote.status).toBe("sent");
    expect(again.quote.token).toBe(q.token);

    const notifs = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, customer.id), eq(notifications.type, "quote.sent")));
    expect(notifs).toHaveLength(2);
    const mails = await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.toEmail, customer.email));
    expect(mails).toHaveLength(2);
    expect(mails.some((m) => (m.payload as { resend?: boolean }).resend === true)).toBe(true);

    // Expiry: job flips it, customer sees expired + cannot accept.
    await db
      .update(customQuotes)
      .set({ expiresAt: new Date(Date.now() - 3600_000) })
      .where(eq(customQuotes.id, q.quoteId));
    const run = await quoteExpiryJob.run(new Date());
    expect(run.expiredQuoteIds).toContain(q.quoteId);
    const expiredView = await quotesService.getQuote(custCtx, { token: q.token });
    expect(expiredView.quote.status).toBe("expired");
    expect(expiredView.canAccept).toBe(false);

    // Resend without a new date is refused with a clear message; with one it revives the quote.
    await expect(quotesService.sendCustomQuote(adminCtx, { quoteId: q.quoteId })).rejects.toThrow(
      /validity date/i,
    );
    const revived = await quotesService.sendCustomQuote(adminCtx, {
      quoteId: q.quoteId,
      expiresAt: new Date(Date.now() + 5 * day).toISOString(),
    });
    expect(revived.quote.status).toBe("sent");
    const okView = await quotesService.getQuote(custCtx, { token: q.token });
    expect(okView.canAccept).toBe(true);
  });

  it("validates input: needs an amount or line items; line sum must match amount", async () => {
    const { customer, adminCtx } = await setup();
    await expect(
      quotesService.createCustomQuote(adminCtx, {
        customerId: customer.id,
        title: "No price",
        currency: "INR",
      }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      quotesService.createCustomQuote(adminCtx, {
        customerId: customer.id,
        title: "Mismatch",
        currency: "INR",
        amountMinor: 999,
        lineItems: [{ description: "x", quantity: 1, unitMinor: 1000 }],
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
