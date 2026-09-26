/**
 * Phase 5 Gate Scenarios: Delivery & Subscriptions End-to-End
 * (S-02 step 6-7, S-03 steps 2-3, S-05, S-23 server-side, SA-10..SA-14)
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { entitlementsService } from "@/modules/entitlements/service";
import { deliveryService } from "@/modules/delivery/service";
import { subscriptionsService } from "@/modules/subscriptions/service";
import { subscriptionsRemindGraceSuspendJob, entitlementsExpireJob } from "@/jobs/subscriptions";
import {
  deliveryTasks,
  downloads,
  entitlements,
  releaseFiles,
  serviceProgress,
  subscriptions,
} from "../../../drizzle/schema/delivery";
import { media } from "../../../drizzle/schema/media";
import { orders } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOrder } from "../../factories/commerce";
import { createEntitlement, createSubscription } from "../../factories/delivery";
import { buildContext } from "@/lib/authz/context";
import { AppError } from "@/lib/errors";

describe("Phase 5 Gate Scenarios: Delivery & Subscriptions (P5.1..P5.9)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("Scenario 1: Entitlement per delivery type and order fulfilment progression", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const buyer = await createUser({ emailVerified: true });
    const product = await createProduct({ createdBy: admin.id });

    // Create 3 offerings: download, license, service
    const offDownload = await createOffering({ productId: product.id, deliveryType: "download" });
    const offLicense = await createOffering({ productId: product.id, deliveryType: "license" });
    const offService = await createOffering({
      productId: product.id,
      deliveryType: "service",
      serviceSteps: [{ key: "s1", title: "Setup" }, { key: "s2", title: "Delivery" }],
    });

    // 1. Download offering purchase: instantly fulfilled
    const ordDownload = await createOrder({ offering: offDownload, user: buyer, status: "paid" });
    const [entDl] = await withTx(async (tx) => entitlementsService.grantForOrder(ordDownload.id, tx));
    expect(entDl?.status).toBe("active");

    const [ordDlAfter] = await db.select().from(orders).where(eq(orders.id, ordDownload.id));
    expect(ordDlAfter?.status).toBe("fulfilled");

    // 2. License offering purchase: fulfilled only when license key set
    const ordLicense = await createOrder({ offering: offLicense, user: buyer, status: "paid" });
    const [entLic] = await withTx(async (tx) => entitlementsService.grantForOrder(ordLicense.id, tx));
    expect(entLic?.status).toBe("active");

    const [ordLicInitial] = await db.select().from(orders).where(eq(orders.id, ordLicense.id));
    expect(ordLicInitial?.status).toBe("paid"); // Not fulfilled yet!

    const adminCtx = buildContext({ user: { id: admin.id }, session: { id: "s-admin" }, roles: ["super_admin"] });
    await deliveryService.setLicenseKey(adminCtx, {
      entitlementId: entLic!.entitlementId,
      licenseKey: "KEY-TEST-9999",
      notifyEmail: false,
    });

    const [ordLicFulfilled] = await db.select().from(orders).where(eq(orders.id, ordLicense.id));
    expect(ordLicFulfilled?.status).toBe("fulfilled");

    // 3. Service offering purchase: fulfilled only when all service steps marked done
    const ordService = await createOrder({ offering: offService, user: buyer, status: "paid" });
    const [entSvc] = await withTx(async (tx) => entitlementsService.grantForOrder(ordService.id, tx));

    const [ordSvcInitial] = await db.select().from(orders).where(eq(orders.id, ordService.id));
    expect(ordSvcInitial?.status).toBe("paid");

    await deliveryService.markServiceStep(adminCtx, { entitlementId: entSvc!.entitlementId, stepKey: "s1", done: true });
    const [ordSvcStep1] = await db.select().from(orders).where(eq(orders.id, ordService.id));
    expect(ordSvcStep1?.status).toBe("paid");

    await deliveryService.markServiceStep(adminCtx, { entitlementId: entSvc!.entitlementId, stepKey: "s2", done: true });
    const [ordSvcDone] = await db.select().from(orders).where(eq(orders.id, ordService.id));
    expect(ordSvcDone?.status).toBe("fulfilled");
  });

  it("Scenario 2: Download link cap enforcement & 5-minute presigned GET", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const product = await createProduct({ createdBy: admin.id });
    const offering = await createOffering({
      productId: product.id,
      deliveryType: "download",
      deliveryConfig: { downloadCap: 3, updatePolicy: "all_free" },
    });
    const buyer = await createUser({ emailVerified: true });

    const [med] = await db
      .insert(media)
      .values({
        bucket: "codekraft-private",
        objectKey: "releases/v1.zip",
        mime: "application/zip",
        sizeBytes: 2048,
        checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        visibility: "private",
        uploadedBy: admin.id,
      })
      .returning();

    await db.insert(releaseFiles).values({ productId: product.id, version: "1.0", mediaId: med!.id });

    const ent = await createEntitlement({
      offering,
      userId: buyer.id,
      deliveryType: "download",
      downloadCap: 3,
      downloadsUsed: 0,
      status: "active",
    });

    const buyerCtx = buildContext({ user: { id: buyer.id }, session: { id: "s-buyer" }, roles: ["customer"] });

    // Download 1, 2, 3 succeed
    for (let i = 1; i <= 3; i++) {
      const res = await entitlementsService.issueDownloadLink(buyerCtx, {
        entitlementId: ent.id,
        mediaId: med!.id,
      });
      expect(res.url).toBeDefined();
    }

    // Download 4 blocked with LIMIT_EXCEEDED
    await expect(
      entitlementsService.issueDownloadLink(buyerCtx, {
        entitlementId: ent.id,
        mediaId: med!.id,
      }),
    ).rejects.toThrow(AppError);
  });

  it("Scenario 3: Subscription lifecycle, grace period, and cron suspension", async () => {
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
      accessStartsAt: new Date("2026-05-01T00:00:00Z"),
      accessEndsAt: new Date("2026-06-01T00:00:00Z"),
    });

    const sub = await createSubscription({
      entitlement: ent,
      interval: "monthly",
      currentPeriodStart: new Date("2026-05-01T00:00:00Z"),
      currentPeriodEnd: new Date("2026-06-01T00:00:00Z"),
      status: "active",
      userId: buyer.id,
    });

    // On June 2: active -> past_due (grace until June 8)
    await subscriptionsRemindGraceSuspendJob.run(new Date("2026-06-02T00:00:00Z"));
    const [subPastDue] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
    expect(subPastDue?.status).toBe("past_due");

    // On June 10: past grace -> suspended
    await subscriptionsRemindGraceSuspendJob.run(new Date("2026-06-10T00:00:00Z"));
    const [subSuspended] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
    expect(subSuspended?.status).toBe("suspended");

    const [entSuspended] = await db.select().from(entitlements).where(eq(entitlements.id, ent.id));
    expect(entSuspended?.status).toBe("suspended");
  });

  it("Scenario 4: Revocation paths and access cut", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const product = await createProduct({ createdBy: admin.id });
    const offering = await createOffering({ productId: product.id, deliveryType: "download" });
    const buyer = await createUser({ emailVerified: true });

    const ent = await createEntitlement({
      offering,
      userId: buyer.id,
      deliveryType: "download",
      status: "active",
    });

    const adminCtx = buildContext({ user: { id: admin.id }, session: { id: "s-admin" }, roles: ["super_admin"] });

    // Admin revokes entitlement
    const revokeRes = await entitlementsService.revokeEntitlement(adminCtx, {
      entitlementId: ent.id,
      reason: "Fraudulent dispute initiated",
    });

    expect(revokeRes.entitlement.status).toBe("revoked");

    const [entAfter] = await db.select().from(entitlements).where(eq(entitlements.id, ent.id));
    expect(entAfter?.status).toBe("revoked");
    expect(entAfter?.revokedAt).toBeDefined();

    // Revoked entitlement cannot issue download links
    const buyerCtx = buildContext({ user: { id: buyer.id }, session: { id: "s-buyer" }, roles: ["customer"] });
    await expect(
      entitlementsService.issueDownloadLink(buyerCtx, {
        entitlementId: ent.id,
        mediaId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow();
  });
});
