import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { mediaService } from "@/modules/media/service";
import { MemoryStorageDriver, getPublicBucketName, setStorageDriver } from "@/lib/storage";
import { createAdmin } from "../../factories/users";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("complete step deletes any object that fails validation (SEC p19-4 #5)", () => {
  let storage: MemoryStorageDriver;

  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
    storage = new MemoryStorageDriver();
    setStorageDriver(storage);
  });

  async function intentFor(opts: { mime: string; filename: string; sizeBytes: number }) {
    const admin = await createAdmin();
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });
    const intent = await mediaService.createUploadIntent(ctx, {
      purpose: "product_image",
      ...opts,
    });
    return { ctx, intent };
  }

  const exists = (key: string) =>
    storage.headObject(getPublicBucketName(), key).then(
      () => true,
      () => false,
    );

  it("deletes on magic-byte mismatch", async () => {
    const { ctx, intent } = await intentFor({
      mime: "image/png",
      filename: "a.png",
      sizeBytes: 1024,
    });
    await storage.putObject(
      getPublicBucketName(),
      intent.objectKey,
      Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj"),
      "image/png",
    );
    await expect(
      mediaService.completeUpload(ctx, { intentId: intent.intentId }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION });
    expect(await exists(intent.objectKey)).toBe(false);
  });

  it("deletes an empty object", async () => {
    const { ctx, intent } = await intentFor({
      mime: "image/png",
      filename: "a.png",
      sizeBytes: 1024,
    });
    await storage.putObject(getPublicBucketName(), intent.objectKey, Buffer.alloc(0), "image/png");
    await expect(
      mediaService.completeUpload(ctx, { intentId: intent.intentId }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION });
    expect(await exists(intent.objectKey)).toBe(false);
  });

  it("deletes an object larger than the declared size", async () => {
    const { ctx, intent } = await intentFor({
      mime: "image/png",
      filename: "a.png",
      sizeBytes: 100,
    });
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(5000),
    ]);
    await storage.putObject(getPublicBucketName(), intent.objectKey, png, "image/png");
    await expect(
      mediaService.completeUpload(ctx, { intentId: intent.intentId }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION });
    expect(await exists(intent.objectKey)).toBe(false);
  });

  it("keeps a valid object (declared size honoured)", async () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(100),
    ]);
    const { ctx, intent } = await intentFor({
      mime: "image/png",
      filename: "a.png",
      sizeBytes: png.length,
    });
    await storage.putObject(getPublicBucketName(), intent.objectKey, png, "image/png");
    const res = await mediaService.completeUpload(ctx, { intentId: intent.intentId });
    expect(res.mediaId).toBeTruthy();
    expect(await exists(intent.objectKey)).toBe(true);
  });
});
