import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotesService } from "@/modules/quotes/service";
import { quoteExpiryJob } from "@/jobs/quote-expiry";
import { customQuotes } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { buildContext } from "@/lib/authz/context";

describe("Quote expiry job idempotency (docs/06 §3.3)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("expires unaccepted quotes past expiresAt and is idempotent on repeat runs", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();

    const quote1 = await quotesService.createCustomQuote(adminCtx, {
      customerId: customer.id,
      title: "Offer 1",
      currency: "INR",
      amountMinor: 10000,
      expiresAt: pastDate,
    });
    await quotesService.sendCustomQuote(adminCtx, { quoteId: quote1.quoteId });

    const quote2 = await quotesService.createCustomQuote(adminCtx, {
      customerId: customer.id,
      title: "Offer 2",
      currency: "INR",
      amountMinor: 20000,
      expiresAt: pastDate,
    });
    await quotesService.sendCustomQuote(adminCtx, { quoteId: quote2.quoteId });

    // Run 1: expires both quotes
    const run1 = await quoteExpiryJob.run(new Date());
    expect(run1.expiredCount).toBe(2);
    expect(run1.expiredQuoteIds).toContain(quote1.quoteId);
    expect(run1.expiredQuoteIds).toContain(quote2.quoteId);

    // Verify DB states
    const [q1] = await db
      .select()
      .from(customQuotes)
      .where(eq(customQuotes.id, quote1.quoteId));
    expect(q1?.status).toBe("expired");

    // Run 2: idempotent, no more quotes to expire
    const run2 = await quoteExpiryJob.run(new Date());
    expect(run2.expiredCount).toBe(0);
    expect(run2.expiredQuoteIds).toEqual([]);
  });
});
