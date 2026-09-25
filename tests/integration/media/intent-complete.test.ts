import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { mediaService } from "@/modules/media/service";
import { MemoryStorageDriver, getPublicBucketName, setStorageDriver } from "@/lib/storage";
import { media } from "../../../drizzle/schema/media";
import { filesUploadIntents } from "../../../drizzle/schema/ops";
import { createAdmin, createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("media upload intent and completion (docs/06 §3.5, API-CAT-21, PHASE-03 P3.5)", () => {
  const _sql = getTestDb();
  let memoryStorage: MemoryStorageDriver;

  beforeAll(async () => {
    await migrateTestDb();
  });

  beforeEach(async () => {
    await truncateAll();
    memoryStorage = new MemoryStorageDriver();
    setStorageDriver(memoryStorage);
  });

  it("handles admin product_image upload intent and completion", async () => {
    const db = (await import("@/lib/db")).db;
    const admin = await createAdmin();

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    // 1. Create upload intent
    const intentRes = await mediaService.createUploadIntent(adminCtx, {
      purpose: "product_image",
      filename: "hero.png",
      mime: "image/png",
      sizeBytes: 1024,
    });

    expect(intentRes.intentId).toBeDefined();
    expect(intentRes.uploadUrl).toBeDefined();
    expect(intentRes.objectKey).toMatch(/^media\/\d{4}\/\d{2}\/[a-f0-9-]+\.png$/);
    expect(intentRes.visibility).toBe("public");

    // 2. Verify files_upload_intents row in DB
    const [intentRow] = await db
      .select()
      .from(filesUploadIntents)
      .where(eq(filesUploadIntents.id, intentRes.intentId));
    expect(intentRow).toBeDefined();
    expect(intentRow?.consumed).toBe(false);

    // 3. Simulate upload by putting valid PNG bytes into storage driver
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52,
    ]);
    await memoryStorage.putObject(
      getPublicBucketName(),
      intentRes.objectKey,
      pngBytes,
      "image/png",
    );

    // 4. Complete upload
    const completeRes = await mediaService.completeUpload(adminCtx, {
      intentId: intentRes.intentId,
    });

    expect(completeRes.mediaId).toBeDefined();
    expect(completeRes.url).toBeDefined();
    expect(completeRes.url).toContain(intentRes.objectKey);

    // 5. Verify media row inserted in database
    const [mediaRow] = await db.select().from(media).where(eq(media.id, completeRes.mediaId));
    expect(mediaRow).toBeDefined();
    expect(mediaRow?.mime).toBe("image/png");
    expect(mediaRow?.visibility).toBe("public");
    expect(mediaRow?.sizeBytes).toBe(pngBytes.length);

    // 6. Verify intent is now marked consumed
    const [consumedIntent] = await db
      .select()
      .from(filesUploadIntents)
      .where(eq(filesUploadIntents.id, intentRes.intentId));
    expect(consumedIntent?.consumed).toBe(true);

    // 7. Re-completing the same intent fails with STATE_INVALID
    await expect(
      mediaService.completeUpload(adminCtx, { intentId: intentRes.intentId }),
    ).rejects.toMatchObject({
      code: ErrorCode.STATE_INVALID,
    });
  });

  it("allows customer session to upload avatar without media.upload permission", async () => {
    const customer = await createUser();

    const customerCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust" },
      roles: ["customer"],
    });

    const intent = await mediaService.createUploadIntent(customerCtx, {
      purpose: "avatar",
      filename: "profile.webp",
      mime: "image/webp",
      sizeBytes: 2048,
    });

    expect(intent.intentId).toBeDefined();
    expect(intent.visibility).toBe("public");

    // Attempting an admin purpose as customer is rejected
    await expect(
      mediaService.createUploadIntent(customerCtx, {
        purpose: "product_image",
        filename: "test.png",
        mime: "image/png",
        sizeBytes: 1024,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });
});
