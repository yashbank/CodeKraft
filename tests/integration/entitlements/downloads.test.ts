import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { entitlementsService } from "@/modules/entitlements/service";
import { downloads, entitlements, releaseFiles } from "../../../drizzle/schema/delivery";
import { media } from "../../../drizzle/schema/media";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createEntitlement } from "../../factories/delivery";
import { buildContext } from "@/lib/authz/context";
import { AppError } from "@/lib/errors";

describe("Entitlements Downloads & Caps (API-DEL-02, BR-15, SA-11, SA-12)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("enforces atomic download cap, logs download, and rejects when cap is exceeded", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const product = await createProduct({ createdBy: admin.id });
    const offering = await createOffering({
      productId: product.id,
      deliveryType: "download",
      deliveryConfig: { downloadCap: 2, updatePolicy: "all_free" },
    });
    const buyer = await createUser({ emailVerified: true });

    const [med] = await db
      .insert(media)
      .values({
        bucket: "codekraft-private",
        objectKey: "releases/test-build-1.0.0.zip",
        mime: "application/zip",
        sizeBytes: 1048576,
        checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        visibility: "private",
        uploadedBy: admin.id,
      })
      .returning();

    await db.insert(releaseFiles).values({
      productId: product.id,
      version: "1.0.0",
      mediaId: med!.id,
    });

    const ent = await createEntitlement({
      offering,
      userId: buyer.id,
      deliveryType: "download",
      downloadCap: 2,
      downloadsUsed: 0,
      status: "active",
    });

    const buyerCtx = buildContext({
      user: { id: buyer.id },
      session: { id: "sess-buyer" },
      roles: ["customer"],
    });

    // 1st download succeeds
    const d1 = await entitlementsService.issueDownloadLink(buyerCtx, {
      entitlementId: ent.id,
      mediaId: med!.id,
    });
    expect(d1.url).toBeDefined();
    expect(d1.downloadsRemaining).toBe(1);

    // 2nd download succeeds
    const d2 = await entitlementsService.issueDownloadLink(buyerCtx, {
      entitlementId: ent.id,
      mediaId: med!.id,
    });
    expect(d2.downloadsRemaining).toBe(0);

    // 3rd download exceeds cap -> throws LIMIT_EXCEEDED
    await expect(
      entitlementsService.issueDownloadLink(buyerCtx, {
        entitlementId: ent.id,
        mediaId: med!.id,
      }),
    ).rejects.toThrow(AppError);

    // Verify downloads table has 2 rows
    const dlRows = await db.select().from(downloads).where(eq(downloads.entitlementId, ent.id));
    expect(dlRows).toHaveLength(2);

    // Admin resets cap
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    await entitlementsService.resetDownloadCount(adminCtx, {
      entitlementId: ent.id,
      newCap: 5,
    });

    const [entAfterReset] = await db.select().from(entitlements).where(eq(entitlements.id, ent.id));
    expect(entAfterReset?.downloadsUsed).toBe(0);
    expect(entAfterReset?.downloadCap).toBe(5);

    // Can download again
    const d3 = await entitlementsService.issueDownloadLink(buyerCtx, {
      entitlementId: ent.id,
      mediaId: med!.id,
    });
    expect(d3.downloadsRemaining).toBe(4);
  });
});
