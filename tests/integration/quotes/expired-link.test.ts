import { beforeAll, describe, expect, it } from "vitest";
import { quotesService } from "@/modules/quotes/service";
import { AppError, ErrorCode } from "@/lib/errors";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { buildContext } from "@/lib/authz/context";

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
    const quoteRes = await quotesService.createCustomQuote(adminCtx, {
      customerId: customer.id,
      title: "Expiring Offer",
      currency: "INR",
      amountMinor: 25000,
      expiresAt: pastDate,
    });

    await quotesService.sendCustomQuote(adminCtx, { quoteId: quoteRes.quoteId });

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
