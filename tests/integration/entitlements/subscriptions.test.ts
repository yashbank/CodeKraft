import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { subscriptionsService } from "@/modules/subscriptions/service";
import { subscriptionsRemindGraceSuspendJob } from "@/jobs/subscriptions";
import { entitlements, subscriptions } from "../../../drizzle/schema/delivery";
import { orders } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createEntitlement, createSubscription } from "../../factories/delivery";
import { buildContext } from "@/lib/authz/context";

describe("Subscriptions Lifecycle & Cron (API-DEL-04/05/14, BR-14, MASTER_SPEC §7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("handles renewal order generation, payment roll-forward, and cancellation", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const product = await createProduct({ createdBy: admin.id });
    const offering = await createOffering({
      productId: product.id,
      purchaseModel: "subscription",
      billingInterval: "monthly",
      deliveryType: "saas",
      price: { amountMinor: 50000, currency: "INR" },
    });
    const buyer = await createUser({ emailVerified: true });

    const ent = await createEntitlement({
      offering,
      userId: buyer.id,
      deliveryType: "saas",
      status: "active",
      accessStartsAt: new Date("2026-01-01T00:00:00Z"),
      accessEndsAt: new Date("2026-02-01T00:00:00Z"),
    });

    const sub = await createSubscription({
      entitlement: ent,
      interval: "monthly",
      currentPeriodStart: new Date("2026-01-01T00:00:00Z"),
      currentPeriodEnd: new Date("2026-02-01T00:00:00Z"),
      status: "active",
      userId: buyer.id,
    });

    const buyerCtx = buildContext({
      user: { id: buyer.id },
      session: { id: "sess-buyer" },
      roles: ["customer"],
    });

    // 1. Customer initiates renewal
    const renewRes = await subscriptionsService.renew(buyerCtx, {
      entitlementId: ent.id,
      paymentMethod: "manual_upi",
      billing: { name: "Buyer", email: buyer.email, country: "IN" },
    });

    expect(renewRes.orderId).toBeDefined();
    expect(renewRes.existing).toBe(false);

    // 2. Renewal payment paid -> period rolled forward
    await withTx(async (tx) => {
      await subscriptionsService.onRenewalPaid(renewRes.orderId, tx);
    });

    const [subAfter] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
    expect(subAfter?.status).toBe("active");
    expect(new Date(subAfter!.currentPeriodEnd).toISOString()).toBe(
      new Date("2026-03-01T00:00:00Z").toISOString(),
    );

    // 3. Customer cancels at period end
    const cancelRes = await subscriptionsService.cancelAtPeriodEnd(buyerCtx, {
      entitlementId: ent.id,
      reason: "No longer needed",
    });
    expect(cancelRes.cancelAtPeriodEnd).toBe(true);
  });

  it("cron transitions expired active subscription to past_due, then suspended after grace", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const product = await createProduct({ createdBy: admin.id });
    const offering = await createOffering({
      productId: product.id,
      purchaseModel: "subscription",
      billingInterval: "monthly",
      deliveryType: "saas",
    });
    const buyer = await createUser({ emailVerified: true });

    const ent = await createEntitlement({
      offering,
      userId: buyer.id,
      deliveryType: "saas",
      status: "active",
      accessStartsAt: new Date("2026-01-01T00:00:00Z"),
      accessEndsAt: new Date("2026-02-01T00:00:00Z"),
    });

    const sub = await createSubscription({
      entitlement: ent,
      interval: "monthly",
      currentPeriodStart: new Date("2026-01-01T00:00:00Z"),
      currentPeriodEnd: new Date("2026-02-01T00:00:00Z"),
      status: "active",
      userId: buyer.id,
    });

    // Run cron on Feb 2 (period ended Feb 1) -> moves to past_due (grace until Feb 8)
    const cron1 = await subscriptionsRemindGraceSuspendJob.run(new Date("2026-02-02T00:00:00Z"));
    expect(cron1.detail.movedToPastDue).toBe(1);

    const [subPastDue] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
    expect(subPastDue?.status).toBe("past_due");
    expect(subPastDue?.graceUntil).toBeDefined();

    // Run cron on Feb 10 (past grace) -> moves to suspended
    const cron2 = await subscriptionsRemindGraceSuspendJob.run(new Date("2026-02-10T00:00:00Z"));
    expect(cron2.detail.suspended).toBe(1);

    const [subSuspended] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
    expect(subSuspended?.status).toBe("suspended");

    const [entSuspended] = await db.select().from(entitlements).where(eq(entitlements.id, ent.id));
    expect(entSuspended?.status).toBe("suspended");
  });
});
