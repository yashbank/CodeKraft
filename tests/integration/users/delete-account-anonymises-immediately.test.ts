/**
 * @security SA-21 (instant anonymization on account deletion, preserving legal/financial history)
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { usersService } from "@/modules/users/service";
import { accounts, sessions, twoFactor, users } from "../../../drizzle/schema/auth";
import { customerProfiles } from "../../../drizzle/schema/users-ext";
import { orders } from "../../../drizzle/schema/commerce";
import { invoices } from "../../../drizzle/schema/invoices";
import { subscriptions } from "../../../drizzle/schema/delivery";
import { wishlists } from "../../../drizzle/schema/catalog";
import { conversations } from "../../../drizzle/schema/chat";
import { FACTORY_PASSWORD, createUser } from "../../factories/users";
import { createInvoice, createOrder } from "../../factories/commerce";
import { createEntitlement, createSubscription } from "../../factories/delivery";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createConversation } from "../../factories/leads";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("deleteAccount immediate anonymisation (API-AUTH-08, BR-18, SA-21, PHASE-03 P3.4)", () => {
  const _sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  it("anonymises PII in one transaction while keeping orders, invoices, and audit logs intact", async () => {
    await truncateAll();
    const db = (await import("@/lib/db")).db;

    const customer = await createUser({
      name: "Original Name",
    });

    const userCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-user-1" },
      roles: ["customer"],
    });

    // Populate customer profile
    await db.insert(customerProfiles).values({
      userId: customer.id,
      company: "Acme Corp",
      billingName: "Original Billing",
      country: "IN",
      gstNumber: "27AAAAA0000A1Z5",
      tags: ["vip"],
    });

    // Populate a session
    await db.insert(sessions).values({
      userId: customer.id,
      token: "tok-user-active",
      expiresAt: new Date(Date.now() + 1000 * 3600),
      host: "site",
    });

    // Populate 2FA
    await db.insert(twoFactor).values({
      userId: customer.id,
      secret: "JBSWY3DPEHPK3PXP",
      backupCodes: "code1,code2",
      verified: true,
    });

    // Create product and offering
    const product = await createProduct({ name: "Widget" });
    const offering = await createOffering({ productId: product.id, deliveryType: "download" });

    // Populate wishlist
    await db.insert(wishlists).values({
      userId: customer.id,
      productId: product.id,
    });

    // Populate an order (financial record)
    const order = await createOrder({
      user: customer,
      status: "paid",
    });

    // Populate an invoice (legal record) using factory
    const invoice = await createInvoice({
      order,
    });

    // Populate an entitlement with active subscription
    const ent = await createEntitlement({
      user: customer,
      offering,
      deliveryType: "download",
      status: "active",
    });
    const sub = await createSubscription({
      entitlement: ent,
      status: "active",
    });

    // Populate chat conversation
    await createConversation({
      userId: customer.id,
    });

    // Perform account deletion
    const res = await usersService.deleteAccount(userCtx, {
      confirmPhrase: "DELETE",
      password: FACTORY_PASSWORD,
    });

    expect(res.anonymizedAt).toBeDefined();

    // 1. Verify user record anonymisation
    const [anonUser] = await db.select().from(users).where(eq(users.id, customer.id));
    expect(anonUser!.status).toBe("deleted");
    expect(anonUser!.deletedAt).not.toBeNull();
    expect(anonUser!.anonymizedAt).not.toBeNull();
    expect(anonUser!.name).toBe("Deleted User");
    expect(anonUser!.email).toBe(`deleted-${customer.id}@anon.invalid`);
    expect(anonUser!.phoneNumber).toBeNull();
    expect(anonUser!.image).toBeNull();
    expect(anonUser!.twoFactorEnabled).toBe(false);

    // 2. Verify customer profile, accounts, twoFactor, sessions, wishlists are deleted
    const profiles = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, customer.id));
    expect(profiles).toHaveLength(0);

    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, customer.id));
    expect(userAccounts).toHaveLength(0);

    const user2FA = await db.select().from(twoFactor).where(eq(twoFactor.userId, customer.id));
    expect(user2FA).toHaveLength(0);

    const userSessions = await db.select().from(sessions).where(eq(sessions.userId, customer.id));
    expect(userSessions).toHaveLength(0);

    const userWishlist = await db.select().from(wishlists).where(eq(wishlists.userId, customer.id));
    expect(userWishlist).toHaveLength(0);

    // 3. Verify active subscriptions were cancelled
    const [updatedSub] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
    expect(updatedSub!.status).toBe("cancelled");

    // 4. Verify chat conversations are purged
    const chatConvs = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, customer.id));
    expect(chatConvs).toHaveLength(0);

    // 5. CRITICAL: Financial & legal history remains intact and links to anonymized user row
    const [retainedOrder] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(retainedOrder).toBeDefined();
    expect(retainedOrder!.userId).toBe(customer.id);

    const [retainedInvoice] = await db.select().from(invoices).where(eq(invoices.id, invoice.id));
    expect(retainedInvoice).toBeDefined();
  });

  it("refuses account deletion with STATE_INVALID when active service entitlement is in progress", async () => {
    await truncateAll();
    const customer = await createUser();
    const product = await createProduct();
    const offering = await createOffering({ productId: product.id, deliveryType: "service" });

    // Active service entitlement
    await createEntitlement({
      user: customer,
      offering,
      deliveryType: "service",
      status: "active",
    });

    const userCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-user-2" },
      roles: ["customer"],
    });

    await expect(
      usersService.deleteAccount(userCtx, {
        confirmPhrase: "DELETE",
        password: FACTORY_PASSWORD,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.STATE_INVALID,
      message: /active service entitlement in progress/i,
    });
  });
});
