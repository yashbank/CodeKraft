// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { GET as publicGET } from "@/app/api/files/public/[...path]/route";
import { MemoryStorageDriver, getPublicBucketName, setStorageDriver } from "@/lib/storage";
import { upiQrImageSchema } from "@/modules/settings/contracts";
import { createUploadIntentSchema } from "@/modules/media/contracts";
import { UPLOAD_RULES } from "@/modules/media/types";

afterEach(() => setStorageDriver(null));

describe("P15-01 gaps", () => {
  it("public proxy sets nosniff next to the immutable cache header", async () => {
    const d = new MemoryStorageDriver();
    setStorageDriver(d);
    await d.putObject(getPublicBucketName(), "media/2026/10/a.png", Buffer.from([1]), "image/png");
    const res = await publicGET(new Request("http://x/"), {
      params: Promise.resolve({ path: ["media", "2026", "10", "a.png"] }),
    });
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("payment QR goes through the media pipeline (public bucket), not a DB data URL", () => {
    const rule = (UPLOAD_RULES as Record<string, { visibility: string; mimes: readonly string[] }>)
      .payment_qr;
    expect(rule?.visibility).toBe("public");
    expect(rule?.mimes).toEqual(["image/png", "image/jpeg", "image/webp"]);
    expect(
      createUploadIntentSchema.safeParse({
        purpose: "payment_qr",
        filename: "qr.png",
        mime: "image/png",
        sizeBytes: 1000,
      }).success,
    ).toBe(true);
    // setting stores the media URL ...
    expect(
      upiQrImageSchema.safeParse("https://media.example.com/media/2026/10/a.png").success,
    ).toBe(true);
    expect(upiQrImageSchema.safeParse("/api/files/public/media/2026/10/a.png").success).toBe(true);
    // ... legacy inline data URLs already saved keep validating, junk still does not
    expect(upiQrImageSchema.safeParse("data:image/png;base64,QUJD").success).toBe(true);
    expect(upiQrImageSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(upiQrImageSchema.safeParse("data:image/svg+xml;base64,QUJD").success).toBe(false);
  });
});
