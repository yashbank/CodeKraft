import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LocalFsStorageDriver,
  localObjectPath,
  signLocalUrl,
  verifyLocalUrl,
} from "@/lib/storage-local";

describe("LocalFsStorageDriver (dev uploads without a bucket)", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "ck-local-storage-"));
    vi.stubEnv("LOCAL_STORAGE_DIR", dir);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips an object with its content type", async () => {
    const d = new LocalFsStorageDriver();
    await d.putObject("pub", "media/2026/10/a.png", Buffer.from([1, 2, 3, 4]), "image/png");
    const head = await d.headObject("pub", "media/2026/10/a.png");
    expect(head).toMatchObject({ contentLength: 4, contentType: "image/png" });
    expect([...(await d.getObjectRange("pub", "media/2026/10/a.png", 1, 2))]).toEqual([2, 3]);
    await d.deleteObject("pub", "media/2026/10/a.png");
    await expect(d.headObject("pub", "media/2026/10/a.png")).rejects.toThrow(/not found/);
  });

  it("mints relative signed PUT URLs that verify only for the same op/key", async () => {
    const url = await new LocalFsStorageDriver().createPresignedPut(
      "pub",
      "k.png",
      "image/png",
      60,
    );
    expect(url.startsWith("/api/files/local?")).toBe(true);
    const q = new URL(url, "http://x").searchParams;
    const exp = Number(q.get("exp"));
    const sig = q.get("sig") ?? "";
    expect(verifyLocalUrl("put", "pub", "k.png", exp, sig)).toBe(true);
    expect(verifyLocalUrl("get", "pub", "k.png", exp, sig)).toBe(false);
    expect(verifyLocalUrl("put", "pub", "other.png", exp, sig)).toBe(false);
    expect(
      verifyLocalUrl(
        "put",
        "pub",
        "k.png",
        Date.now() - 1,
        signLocalUrl("put", "pub", "k.png", Date.now() - 1),
      ),
    ).toBe(false);
  });

  it("refuses keys that escape the storage root", () => {
    expect(() => localObjectPath("pub", "../../etc/passwd")).toThrow();
  });
});
