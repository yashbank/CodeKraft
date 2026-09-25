import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { count } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { mediaService } from "@/modules/media/service";
import { MemoryStorageDriver, getPublicBucketName, setStorageDriver } from "@/lib/storage";
import { media } from "../../../drizzle/schema/media";
import { createAdmin } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("magic-byte mismatch and payload rejection (docs/09 TM-12, SA-13, PHASE-03 P3.5)", () => {
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

  it("rejects completion when uploaded bytes do not match declared MIME (SA-13)", async () => {
    const db = (await import("@/lib/db")).db;
    const admin = await createAdmin();

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    // Create intent for image/png
    const intentRes = await mediaService.createUploadIntent(adminCtx, {
      purpose: "product_image",
      filename: "photo.png",
      mime: "image/png",
      sizeBytes: 1024,
    });

    // Instead of PNG bytes, put PDF bytes into storage
    const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj");
    await memoryStorage.putObject(
      getPublicBucketName(),
      intentRes.objectKey,
      pdfBytes,
      "image/png",
    );

    // Complete upload must reject with VALIDATION error
    await expect(
      mediaService.completeUpload(adminCtx, { intentId: intentRes.intentId }),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION,
    });

    // No media row was inserted
    const [mediaCount] = await db.select({ count: count() }).from(media);
    expect(mediaCount?.count).toBe(0);
  });

  it("rejects uploaded dangerous executable binaries masquerading as allowed types (SA-13)", async () => {
    const db = (await import("@/lib/db")).db;
    const admin = await createAdmin();

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    const intentRes = await mediaService.createUploadIntent(adminCtx, {
      purpose: "product_image",
      filename: "legit.jpg",
      mime: "image/jpeg",
      sizeBytes: 2048,
    });

    // Upload Windows PE binary (MZ header)
    const peBinary = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    await memoryStorage.putObject(
      getPublicBucketName(),
      intentRes.objectKey,
      peBinary,
      "image/jpeg",
    );

    await expect(
      mediaService.completeUpload(adminCtx, { intentId: intentRes.intentId }),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION,
    });

    const [mediaCount] = await db.select({ count: count() }).from(media);
    expect(mediaCount?.count).toBe(0);
  });
});
