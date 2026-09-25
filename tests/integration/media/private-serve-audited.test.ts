import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { ErrorCode } from "@/lib/errors";
import { mediaService } from "@/modules/media/service";
import { MemoryStorageDriver, getPrivateBucketName, setStorageDriver } from "@/lib/storage";
import { auditLogs } from "../../../drizzle/schema/audit";
import { createAdmin, createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("private media serving and audit logging (docs/06 §3.5, SA-12, SA-23, PHASE-03 P3.5)", () => {
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

  it("serves private media with 5-minute presigned GET and logs audit trail (SA-12, SA-23)", async () => {
    const db = (await import("@/lib/db")).db;
    const admin = await createAdmin();
    const customer = await createUser();

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    const customerCtx = buildContext({
      user: { id: customer.id },
      session: { id: "sess-cust" },
      roles: ["customer"],
    });

    // 1. Create upload intent for private presentation PDF
    const intentRes = await mediaService.createUploadIntent(adminCtx, {
      purpose: "product_presentation",
      filename: "whitepaper.pdf",
      mime: "application/pdf",
      sizeBytes: 1024,
    });

    expect(intentRes.visibility).toBe("private");

    // 2. Put valid PDF in storage
    const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj");
    await memoryStorage.putObject(
      getPrivateBucketName(),
      intentRes.objectKey,
      pdfBytes,
      "application/pdf",
    );

    // 3. Complete upload
    const completeRes = await mediaService.completeUpload(adminCtx, {
      intentId: intentRes.intentId,
    });

    expect(completeRes.mediaId).toBeDefined();
    // Private media complete does not return public url
    expect(completeRes.url).toBeUndefined();

    // 4. Unauthorized caller (customer) is rejected with FORBIDDEN
    await expect(
      mediaService.getPrivateMediaUrl(customerCtx, { mediaId: completeRes.mediaId }),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });

    // 5. Admin caller succeeds and receives presigned GET URL with ≤ 5 min lifetime (SA-12)
    const beforeTime = Date.now();
    const urlRes = await mediaService.getPrivateMediaUrl(adminCtx, {
      mediaId: completeRes.mediaId,
    });

    expect(urlRes.url).toBeDefined();
    expect(urlRes.url).toContain("download");
    const expiresAtMs = new Date(urlRes.expiresAt).getTime();
    const ttlSeconds = (expiresAtMs - beforeTime) / 1000;
    // Lifetime must be ≤ 300 s (5 min) per SA-12
    expect(ttlSeconds).toBeGreaterThan(290);
    expect(ttlSeconds).toBeLessThanOrEqual(305);

    // 6. Verify audit log entry was written (SA-23)
    const [auditRow] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.subjectId, completeRes.mediaId));

    expect(auditRow).toBeDefined();
    expect(auditRow?.action).toBe("media.download");
    expect(auditRow?.actorId).toBe(admin.id);
  });
});
