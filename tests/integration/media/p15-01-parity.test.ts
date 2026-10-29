/**
 * P15-01 media parity suite. Pins upload -> view -> replace -> delete and public/private
 * visibility for every media kind, against all three storage drivers with the same assertions:
 * in-memory, local filesystem, and the real S3/R2 driver talking to a fake S3 client.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as downloadGET } from "@/app/api/files/download/[entitlementId]/[mediaId]/route";
import { GET as localGET, PUT as localPUT } from "@/app/api/files/local/route";
import { GET as privateGET } from "@/app/api/files/private/[mediaId]/route";
import { GET as productMediaGET } from "@/app/api/files/product-media/[mediaId]/route";
import { GET as publicGET } from "@/app/api/files/public/[...path]/route";
import { POST as completePOST } from "@/app/api/files/upload-intent/[id]/complete/route";
import { POST as intentPOST } from "@/app/api/files/upload-intent/route";
import { buildContext } from "@/lib/authz/context";
import {
  MemoryStorageDriver,
  S3StorageDriver,
  getDocumentsBucketName,
  getPrivateBucketName,
  getPublicBucketName,
  setStorageDriver,
  type StorageDriver,
} from "@/lib/storage";
import { LocalFsStorageDriver } from "@/lib/storage-local";
import { mediaService } from "@/modules/media/service";
import { UPLOAD_RULES, type UploadPurpose } from "@/modules/media/types";

import { media } from "../../../drizzle/schema/media";
import { productMedia, products } from "../../../drizzle/schema/catalog";
import { releaseFiles } from "../../../drizzle/schema/delivery";
import { createProduct } from "../../factories/catalog";
import { createEntitlement } from "../../factories/delivery";
import { createOffering } from "../../factories/offerings";
import { createAdmin, createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

/* ---- fake S3 client: the real S3StorageDriver, but `client.send` hits a Map ---- */

class FakeS3 {
  store = new Map<string, { body: Buffer; contentType: string }>();
  async send(cmd: { constructor: { name: string }; input: Record<string, unknown> }) {
    const i = cmd.input as {
      Bucket: string;
      Key: string;
      Body?: Buffer | Uint8Array;
      ContentType?: string;
      Range?: string;
      Delete?: { Objects: { Key: string }[] };
    };
    const k = `${i.Bucket}/${i.Key}`;
    const missing = () =>
      Object.assign(new Error("NoSuchKey"), { name: "NotFound", $metadata: { httpStatusCode: 404 } });
    switch (cmd.constructor.name) {
      case "PutObjectCommand":
        this.store.set(k, {
          body: Buffer.from(i.Body as Uint8Array),
          contentType: i.ContentType ?? "application/octet-stream",
        });
        return {};
      case "HeadObjectCommand": {
        const o = this.store.get(k);
        if (!o) throw missing();
        return { ContentLength: o.body.length, ContentType: o.contentType, ETag: '"abc"' };
      }
      case "GetObjectCommand": {
        const o = this.store.get(k);
        if (!o) throw missing();
        let body = o.body;
        const m = /bytes=(\d+)-(\d+)/.exec(i.Range ?? "");
        if (m) body = body.subarray(Number(m[1]), Number(m[2]) + 1);
        return {
          Body: { transformToByteArray: async () => new Uint8Array(body) },
          ContentType: o.contentType,
          ContentLength: body.length,
        };
      }
      case "DeleteObjectCommand":
        this.store.delete(k);
        return {};
      case "DeleteObjectsCommand":
        for (const d of i.Delete?.Objects ?? []) this.store.delete(`${i.Bucket}/${d.Key}`);
        return {};
      default:
        throw new Error(`unexpected command ${cmd.constructor.name}`);
    }
  }
}

function fakeS3Driver(): S3StorageDriver {
  const d = new S3StorageDriver({
    endpoint: "https://acct.r2.cloudflarestorage.com",
    accessKeyId: "AKIAFAKE",
    secretAccessKey: "secret",
  });
  const fake = new FakeS3();
  (d as unknown as { client: { send: FakeS3["send"] } }).client.send = fake.send.bind(fake);
  return d;
}

let localDir = "";
const DRIVERS: Array<[string, () => StorageDriver]> = [
  ["memory", () => new MemoryStorageDriver()],
  ["local-fs", () => new LocalFsStorageDriver()],
  ["s3/r2 (fake client)", fakeS3Driver],
];

/* ---- fixtures ---- */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 1, 2, 3, 4]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([4, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(8)]);
const PDF = Buffer.from("%PDF-1.4\n%fake\n");
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]);
const TXT = Buffer.from("hello attachment");

interface Kind {
  purpose: UploadPurpose;
  file: string;
  mime: string;
  bytes: Buffer;
  admin: boolean; // false = a customer may upload it
}
const PUBLIC_KINDS: Kind[] = [
  { purpose: "product_image", file: "cover.png", mime: "image/png", bytes: PNG, admin: true },
  { purpose: "product_screenshot", file: "s.jpg", mime: "image/jpeg", bytes: JPG, admin: true },
  { purpose: "product_video", file: "v.mp4", mime: "video/mp4", bytes: MP4, admin: true },
  // content_media = blog cover, case-study, landing hero, testimonial/client logos
  { purpose: "content_media", file: "hero.webp", mime: "image/webp", bytes: WEBP, admin: true },
  { purpose: "site_logo", file: "logo.png", mime: "image/png", bytes: PNG, admin: true },
  { purpose: "avatar", file: "me.png", mime: "image/png", bytes: PNG, admin: false },
];
const PRIVATE_KINDS: Kind[] = [
  { purpose: "product_presentation", file: "p.pdf", mime: "application/pdf", bytes: PDF, admin: true },
  { purpose: "product_attachment", file: "a.zip", mime: "application/zip", bytes: ZIP, admin: true },
  { purpose: "release_file", file: "app.zip", mime: "application/zip", bytes: ZIP, admin: true },
  { purpose: "expense_receipt", file: "r.pdf", mime: "application/pdf", bytes: PDF, admin: true },
  { purpose: "query_attachment", file: "q.txt", mime: "text/plain", bytes: TXT, admin: false },
];

const H = (u: { id: string }, roles: string) => ({ "x-test-user-id": u.id, "x-test-roles": roles });
const ADMIN_ROLE = "super_admin";
const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const get = (headers: Record<string, string> = {}) => new Request("http://localhost/x", { headers });
const pubPath = (key: string) => ({ params: Promise.resolve({ path: key.split("/") }) });

describe.each(DRIVERS)("P15-01 media parity [%s driver]", (_name, makeDriver) => {
  const _sql = getTestDb();
  let driver: StorageDriver;
  let admin: { id: string };
  let customer: { id: string };
  let other: { id: string };

  beforeAll(async () => {
    await migrateTestDb();
    localDir = await mkdtemp(path.join(tmpdir(), "ck-p15-"));
  });
  afterAll(async () => {
    setStorageDriver(null);
    await rm(localDir, { recursive: true, force: true });
  });
  beforeEach(async () => {
    vi.stubEnv("LOCAL_STORAGE_DIR", localDir);
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "");
    await truncateAll();
    driver = makeDriver();
    setStorageDriver(driver);
    admin = await createAdmin();
    customer = await createUser({ emailVerified: true });
    other = await createUser({ emailVerified: true });
  });
  afterEach(() => vi.unstubAllEnvs());

  /** Real browser flow: intent -> PUT to the minted URL -> complete. */
  async function upload(k: Kind, as: { id: string }, roles = ADMIN_ROLE) {
    const ires = await intentPOST(
      json({ purpose: k.purpose, filename: k.file, mime: k.mime, sizeBytes: k.bytes.length }, H(as, roles)),
    );
    expect(ires.status).toBe(200);
    const { data: intent } = (await ires.json()) as {
      data: { intentId: string; uploadUrl: string; objectKey: string; visibility: string };
    };
    expect(intent.visibility).toBe(UPLOAD_RULES[k.purpose].visibility);
    const bucket = intent.visibility === "public" ? getPublicBucketName() : getPrivateBucketName();
    if (intent.uploadUrl.startsWith("/api/files/local")) {
      const put = await localPUT(
        new Request(`http://localhost${intent.uploadUrl}`, {
          method: "PUT",
          headers: { "content-type": k.mime },
          body: new Uint8Array(k.bytes),
        }),
      );
      expect(put.status).toBe(200);
    } else {
      if (driver instanceof S3StorageDriver) expect(intent.uploadUrl).toContain("X-Amz-Signature");
      await driver.putObject(bucket, intent.objectKey, k.bytes, k.mime);
    }
    const cres = await completePOST(json({}, H(as, roles)), {
      params: Promise.resolve({ id: intent.intentId }),
    });
    expect(cres.status).toBe(200);
    const { data } = (await cres.json()) as { data: { mediaId: string; url?: string } };
    return { ...intent, bucket, ...data };
  }

  /* ---------------- public kinds ---------------- */
  describe.each(PUBLIC_KINDS)("public kind $purpose", (k) => {
    it("upload -> anonymous view (immutable cache) -> replace -> delete", async () => {
      const up = await upload(k, k.admin ? admin : customer, k.admin ? ADMIN_ROLE : "customer");
      expect(up.bucket).toBe(getPublicBucketName());
      expect(up.url).toMatch(new RegExp(`/api/files/public/${up.objectKey}$`));

      // view: anonymous, no session header
      const res = await publicGET(get(), pubPath(up.objectKey));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe(k.mime);
      expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      expect(Buffer.from(await res.arrayBuffer()).equals(k.bytes)).toBe(true);

      // never leaks into the private bucket
      await expect(driver.headObject(getPrivateBucketName(), up.objectKey)).rejects.toThrow();

      // replace = upload a new object (fresh content-addressed key), swap, delete the old
      const next = await upload(k, k.admin ? admin : customer, k.admin ? ADMIN_ROLE : "customer");
      expect(next.objectKey).not.toBe(up.objectKey);
      const db = (await import("@/lib/db")).db;
      await db.transaction((tx) =>
        mediaService.deleteObjects(
          buildContext({ user: admin, session: { id: "s" }, roles: [ADMIN_ROLE] }),
          [up.mediaId],
          tx,
        ),
      );
      expect((await publicGET(get(), pubPath(up.objectKey))).status).toBe(404);
      expect((await publicGET(get(), pubPath(next.objectKey))).status).toBe(200);
      expect(await db.select().from(media).where(eq(media.id, up.mediaId))).toHaveLength(0);
    });

    it("public objects expose no private route to anonymous or customers", async () => {
      const up = await upload(k, k.admin ? admin : customer, k.admin ? ADMIN_ROLE : "customer");
      const ctx = { params: Promise.resolve({ mediaId: up.mediaId }) };
      expect((await privateGET(get(), ctx)).status).toBe(401);
      expect((await privateGET(get(H(other, "customer")), ctx)).status).toBe(403);
      // admin asking for a *public* object's private link is refused too (400 "is public")
      expect((await privateGET(get(H(admin, ADMIN_ROLE)), ctx)).status).toBe(400);
    });
  });

  /* ---------------- private kinds ---------------- */
  describe.each(PRIVATE_KINDS)("private kind $purpose", (k) => {
    it("upload -> not on the public proxy -> admin signed link -> delete", async () => {
      const up = await upload(k, k.admin ? admin : customer, k.admin ? ADMIN_ROLE : "customer");
      expect(up.bucket).toBe(getPrivateBucketName());
      expect(up.url).toBeUndefined();

      // anonymous cannot read it through the public proxy (different bucket)
      expect((await publicGET(get(), pubPath(up.objectKey))).status).toBe(404);

      const ctx = { params: Promise.resolve({ mediaId: up.mediaId }) };
      expect((await privateGET(get(), ctx)).status).toBe(401);
      expect((await privateGET(get(H(other, "customer")), ctx)).status).toBe(403);
      const ok = await privateGET(get(H(admin, ADMIN_ROLE)), ctx);
      expect(ok.status).toBe(302);
      const loc = new URL(ok.headers.get("location")!, "http://localhost:3000");
      if (driver instanceof LocalFsStorageDriver) {
        const body = await localGET(new Request(loc));
        expect(body.status).toBe(200);
        expect(Buffer.from(await body.arrayBuffer()).equals(k.bytes)).toBe(true);
        // tampered signature is refused
        loc.searchParams.set("sig", "00".repeat(32));
        expect((await localGET(new Request(loc))).status).toBe(403);
      }
      if (driver instanceof S3StorageDriver) expect(loc.searchParams.get("X-Amz-Expires")).toBe("300");

      const db = (await import("@/lib/db")).db;
      await db.transaction((tx) =>
        mediaService.deleteObjects(
          buildContext({ user: admin, session: { id: "s" }, roles: [ADMIN_ROLE] }),
          [up.mediaId],
          tx,
        ),
      );
      await expect(driver.headObject(getPrivateBucketName(), up.objectKey)).rejects.toThrow();
    });
  });

  it("customer-only purposes are refused for anonymous; admin purposes refused for customers", async () => {
    const body = { purpose: "product_image", filename: "a.png", mime: "image/png", sizeBytes: 10 };
    expect((await intentPOST(json(body))).status).toBe(401);
    expect((await intentPOST(json(body, H(customer, "customer")))).status).toBe(403);
    const q = { ...body, purpose: "query_attachment" };
    expect((await intentPOST(json(q))).status).toBe(401);
    expect((await intentPOST(json(q, H(customer, "customer")))).status).toBe(200);
  });

  it("rejects upload whose bytes do not match the declared mime (nothing registered)", async () => {
    const ires = await intentPOST(
      json({ purpose: "product_image", filename: "x.png", mime: "image/png", sizeBytes: 12 }, H(admin, ADMIN_ROLE)),
    );
    const { data } = (await ires.json()) as { data: { intentId: string; objectKey: string } };
    await driver.putObject(getPublicBucketName(), data.objectKey, Buffer.from("<html>hi</html>"), "image/png");
    const c = await completePOST(json({}, H(admin, ADMIN_ROLE)), {
      params: Promise.resolve({ id: data.intentId }),
    });
    expect(c.status).toBe(400);
    const db = (await import("@/lib/db")).db;
    expect(await db.select().from(media)).toHaveLength(0);
  });

  /* ---------------- product media (public image vs private PDF) ---------------- */
  it("product-media route: published PDF visible to visitors, draft only to admin, others 404", async () => {
    const db = (await import("@/lib/db")).db;
    const pdf = await upload(PRIVATE_KINDS[0]!, admin);
    const draft = await createProduct({ status: "draft", createdBy: admin.id });
    const pub = await createProduct({ status: "published", createdBy: admin.id });
    const attach = async (productId: string) =>
      db.insert(productMedia).values({
        productId,
        kind: "presentation",
        mediaId: pdf.mediaId,
        alt: "",
        position: 0,
      });
    const ctx = { params: Promise.resolve({ mediaId: pdf.mediaId }) };

    await attach(draft.id);
    expect((await productMediaGET(get(), ctx)).status).toBe(404);
    expect((await productMediaGET(get(H(customer, "customer")), ctx)).status).toBe(404);
    const asAdmin = await productMediaGET(get(H(admin, ADMIN_ROLE)), ctx);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.headers.get("cache-control")).toMatch(/^private/);
    expect(Buffer.from(await asAdmin.arrayBuffer()).equals(PDF)).toBe(true);

    await db.delete(productMedia);
    await attach(pub.id);
    const anon = await productMediaGET(get(), ctx);
    expect(anon.status).toBe(200);
    expect(anon.headers.get("content-type")).toBe("application/pdf");
    expect(anon.headers.get("cache-control")).toMatch(/^private/);
    expect((await productMediaGET(get(), { params: Promise.resolve({ mediaId: "nope" }) })).status).toBe(404);
    void products;
  });

  it("product image kind must be public; private object is refused", async () => {
    const db = (await import("@/lib/db")).db;
    const product = await createProduct({ createdBy: admin.id });
    const priv = await upload(PRIVATE_KINDS[1]!, admin);
    const pubImg = await upload(PUBLIC_KINDS[0]!, admin);
    const ctx = buildContext({ user: admin, session: { id: "s" }, roles: [ADMIN_ROLE] });
    await expect(
      mediaService.attachProductMedia(ctx, {
        productId: product.id, kind: "image", mediaId: priv.mediaId, alt: "x", position: 0,
      }),
    ).rejects.toThrow(/public/);
    const res = await mediaService.attachProductMedia(ctx, {
      productId: product.id, kind: "image", mediaId: pubImg.mediaId, alt: "x", position: 0,
    });
    expect(res.productMedia[0]?.url).toContain(`/api/files/public/${pubImg.objectKey}`);
    void db;
  });

  /* ---------------- release files: anon denied, entitled customer allowed ---------------- */
  it("release file: anonymous 401, non-owner refused, entitled customer 302 to signed GET", async () => {
    const db = (await import("@/lib/db")).db;
    const rel = await upload(PRIVATE_KINDS[2]!, admin);
    const product = await createProduct({ createdBy: admin.id });
    await db.insert(releaseFiles).values({ productId: product.id, version: "1.0.0", mediaId: rel.mediaId });
    const offering = await createOffering({
      productId: product.id,
      deliveryType: "download",
      deliveryConfig: { downloadCap: 5, updatePolicy: "all_free" },
    });
    const ent = await createEntitlement({
      offering, userId: customer.id, deliveryType: "download", downloadCap: 5, status: "active",
    });
    const ctx = { params: Promise.resolve({ entitlementId: ent.id, mediaId: rel.mediaId }) };

    expect((await downloadGET(get(), ctx)).status).toBe(401);
    expect([403, 404]).toContain((await downloadGET(get(H(other, "customer")), ctx)).status);
    const ok = await downloadGET(get(H(customer, "customer")), ctx);
    expect(ok.status).toBe(302);
    expect(ok.headers.get("location")).toBeTruthy();
    if (driver instanceof LocalFsStorageDriver) {
      const body = await localGET(new Request(new URL(ok.headers.get("location")!, "http://localhost:3000")));
      expect(Buffer.from(await body.arrayBuffer()).equals(ZIP)).toBe(true);
    }
  });

  /* ---------------- documents bucket (invoice / statement PDFs) ---------------- */
  it("documents-bucket objects (invoice PDFs) are never reachable through the public proxy", async () => {
    await driver.putObject(getDocumentsBucketName(), "invoices/2026/INV-1.pdf", PDF, "application/pdf");
    await driver.putObject(getPrivateBucketName(), "invoices/2026/INV-1.pdf", PDF, "application/pdf");
    expect((await publicGET(get(), pubPath("invoices/2026/INV-1.pdf"))).status).toBe(404);
    const url = await driver.createPresignedGet(getDocumentsBucketName(), "invoices/2026/INV-1.pdf", 300);
    expect(url).toContain("invoices");
  });

  /* ---------------- local PUT/GET route is dev-only ---------------- */
  it("/api/files/local only works for the local driver and only with a valid signature", async () => {
    const forged = "http://localhost/api/files/local?bucket=b&key=k&exp=9999999999999&sig=00";
    const status = (await localPUT(new Request(forged, { method: "PUT", body: "x" }))).status;
    expect(status).toBe(driver instanceof LocalFsStorageDriver ? 403 : 404);
    expect((await localGET(new Request(forged))).status).toBe(driver instanceof LocalFsStorageDriver ? 403 : 404);
  });
});

/* ---------------- driver contract (storage level) ---------------- */
describe.each(DRIVERS)("P15-01 storage driver contract [%s]", (_n, makeDriver) => {
  beforeAll(async () => {
    localDir = await mkdtemp(path.join(tmpdir(), "ck-p15c-"));
  });
  beforeEach(() => {
    vi.stubEnv("LOCAL_STORAGE_DIR", localDir);
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(() => rm(localDir, { recursive: true, force: true }));

  it("put -> head -> get -> range -> replace -> delete -> deleteObjects", async () => {
    const d = makeDriver();
    await d.putObject("b", "media/a.bin", Buffer.from([1, 2, 3, 4]), "image/png");
    expect(await d.headObject("b", "media/a.bin")).toMatchObject({ contentLength: 4, contentType: "image/png" });
    expect([...(await d.getObjectRange("b", "media/a.bin", 1, 2))]).toEqual([2, 3]);
    await d.putObject("b", "media/a.bin", "xyz", "text/plain");
    const got = await d.getObject("b", "media/a.bin");
    expect(got.body.toString()).toBe("xyz");
    expect(got.contentType).toBe("text/plain");
    await d.deleteObject("b", "media/a.bin");
    await expect(d.headObject("b", "media/a.bin")).rejects.toThrow();
    await d.putObject("b", "k1", "a");
    await d.putObject("b", "k2", "b");
    await d.deleteObjects("b", ["k1", "k2"]);
    await expect(d.getObject("b", "k1")).rejects.toThrow();
    await expect(d.getObject("b", "k2")).rejects.toThrow();
  });

  it("buckets are isolated and presigned URLs are minted for put and get", async () => {
    const d = makeDriver();
    await d.putObject("pub", "same", "public-bytes");
    await expect(d.getObject("priv", "same")).rejects.toThrow();
    expect(await d.createPresignedPut("pub", "same", "image/png", 900)).toBeTruthy();
    expect(await d.createPresignedGet("pub", "same", 300)).toBeTruthy();
  });
});
