import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customQuotes } from "../../../drizzle/schema/commerce";
import { quotesService } from "@/modules/quotes/service";

import { AppError, ErrorCode } from "@/lib/errors";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { buildContext } from "@/lib/authz/context";

/** Sending an already-expired quote is rejected, so tests backdate the expiry after sending. */
async function backdate(quoteId: string, iso: string) {
  await db
    .update(customQuotes)
    .set({ expiresAt: new Date(iso) })
    .where(eq(customQuotes.id, quoteId));
}
describe("Custom Quotes expired link integration (API-COM-10, BR-10)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("sets canAccept=false and rejects acceptance with ORDER_EXPIRED if expired", async () => {
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

    // Create quote expiring in the past
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
    const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
    const quoteRes = await quotesService.createCustomQuote(adminCtx, {
      customerId: customer.id,
      title: "Expiring Offer",
      currency: "INR",
      amountMinor: 25000,
      expiresAt: futureDate,
    });

    await quotesService.sendCustomQuote(adminCtx, { quoteId: quoteRes.quoteId });
    await backdate(quoteRes.quoteId, pastDate);

    // Customer views quote -> canAccept should be false
    const view = await quotesService.getQuote(custCtx, { token: quoteRes.token });
    expect(view.canAccept).toBe(false);

    // Customer attempts to accept -> throws ORDER_EXPIRED
    await expect(
      quotesService.acceptCustomQuote(custCtx, {
        token: quoteRes.token,
        paymentMethod: "manual_upi",
        billing: {
          name: "Late Customer",
          email: customer.email,
          country: "IN",
        },
      }),
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.ORDER_EXPIRED);
      return true;
    });
  });
});
