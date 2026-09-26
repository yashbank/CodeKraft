import { beforeAll, describe, expect, it } from "vitest";
import { quotesService } from "@/modules/quotes/service";
import { AppError, ErrorCode } from "@/lib/errors";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { buildContext } from "@/lib/authz/context";

describe("Custom Quotes foreign accept forbidden (API-COM-10, MASTER_SPEC §7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("throws FORBIDDEN when a foreign customer attempts to accept a quote", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const customer = await createUser({ emailVerified: true });
    const stranger = await createUser({ emailVerified: true });

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    const strangerCtx = buildContext({
      user: { id: stranger.id },
      session: { id: "sess-stranger" },
      roles: ["user"],
    });

    const quoteRes = await quotesService.createCustomQuote(adminCtx, {
      customerId: customer.id,
      title: "VIP Retainer",
      currency: "INR",
      amountMinor: 30000,
    });

    await quotesService.sendCustomQuote(adminCtx, { quoteId: quoteRes.quoteId });

    // Stranger attempts to accept
    await expect(
      quotesService.acceptCustomQuote(strangerCtx, {
        token: quoteRes.token,
        paymentMethod: "manual_upi",
        billing: {
          name: "Stranger Danger",
          email: stranger.email,
          country: "IN",
        },
      }),
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.FORBIDDEN);
      return true;
    });
  });
});
