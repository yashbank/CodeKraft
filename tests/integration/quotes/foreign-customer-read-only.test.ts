import { beforeAll, describe, expect, it } from "vitest";
import { quotesService } from "@/modules/quotes/service";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { anonymousContext, buildContext } from "@/lib/authz/context";

describe("Custom Quotes foreign customer read-only (API-COM-10, MASTER_SPEC §7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("returns canAccept=false for guest or foreign customer, canAccept=true for owner", async () => {
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

    const ownerCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-owner" },
      roles: ["user"],
    });

    const guestCtx = anonymousContext();

    const quoteRes = await quotesService.createCustomQuote(adminCtx, {
      customerId: customer.id,
      title: "Design Retainer",
      currency: "INR",
      amountMinor: 50000,
    });

    await quotesService.sendCustomQuote(adminCtx, { quoteId: quoteRes.quoteId });

    // 1. Guest view
    const guestView = await quotesService.getQuote(guestCtx, { token: quoteRes.token });
    expect(guestView.quote.title).toBe("Design Retainer");
    expect(guestView.canAccept).toBe(false);

    // 2. Stranger (different logged-in customer) view
    const strangerView = await quotesService.getQuote(strangerCtx, { token: quoteRes.token });
    expect(strangerView.canAccept).toBe(false);

    // 3. Designated customer view
    const ownerView = await quotesService.getQuote(ownerCtx, { token: quoteRes.token });
    expect(ownerView.canAccept).toBe(true);
  });
});
