import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { mediaService } from "@/modules/media/service";
import { AppError } from "@/lib/errors";
import { createAdmin } from "../../factories/users";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { db } from "@/lib/db";
import { media } from "../../../drizzle/schema/media";

describe("product media attachments & visibility rules (API-CAT-06, PHASE-03 P3.7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("enforces media visibility, alt text, PDF presentations, and reordering", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-media-vis" },
      roles: ["admin"],
    });

    const prodRes = await catalogService.createProduct(adminCtx, {
      name: "Media Test Product",
      slug: "media-test-product",
      shortDescription: "Testing media attachments and visibility rules",
    });

    // 1. Create a public PNG media row
    const [publicImage] = await db
      .insert(media)
      .values({
        bucket: "public",
        objectKey: "media/2026/09/cover.png",
        mime: "image/png",
        sizeBytes: 500_000,
        checksum: "sha256cover",
        visibility: "public",
        uploadedBy: admin.id,
      })
      .returning();

    // 2. Create a private PNG media row
    const [privateImage] = await db
      .insert(media)
      .values({
        bucket: "private",
        objectKey: "media/2026/09/secret-cover.png",
        mime: "image/png",
        sizeBytes: 500_000,
        checksum: "sha256secret",
        visibility: "private",
        uploadedBy: admin.id,
      })
      .returning();

    // Attaching private image as 'image' kind must fail
    await expect(
      mediaService.attachProductMedia(adminCtx, {
        productId: prodRes.productId,
        mediaId: privateImage!.id,
        kind: "image",
        alt: "Private cover",
        position: 0,
      }),
    ).rejects.toThrow(AppError);

    // Attaching public image without alt text must fail
    await expect(
      mediaService.attachProductMedia(adminCtx, {
        productId: prodRes.productId,
        mediaId: publicImage!.id,
        kind: "image",
        alt: "   ",
        position: 0,
      }),
    ).rejects.toThrow(AppError);

    // Attaching public image with alt text succeeds
    const attachImageRes = await mediaService.attachProductMedia(adminCtx, {
      productId: prodRes.productId,
      mediaId: publicImage!.id,
      kind: "image",
      alt: "Acme Product Cover",
      position: 0,
    });
    expect(attachImageRes.productMedia.length).toBe(1);

    // 3. Presentation kind must be PDF
    // Try attaching PNG as presentation -> fails
    await expect(
      mediaService.attachProductMedia(adminCtx, {
        productId: prodRes.productId,
        mediaId: publicImage!.id,
        kind: "presentation",
        alt: "",
        position: 1,
      }),
    ).rejects.toThrow(AppError);

    // Create a PDF media row
    const [pdfMedia] = await db
      .insert(media)
      .values({
        bucket: "private",
        objectKey: "media/2026/09/deck.pdf",
        mime: "application/pdf",
        sizeBytes: 2_000_000,
        checksum: "sha256pdf",
        visibility: "private",
        uploadedBy: admin.id,
      })
      .returning();

    const attachPdfRes = await mediaService.attachProductMedia(adminCtx, {
      productId: prodRes.productId,
      mediaId: pdfMedia!.id,
      kind: "presentation",
      alt: "",
      position: 1,
    });
    expect(attachPdfRes.productMedia.length).toBe(2);

    // 4. Video embed must be youtube or vimeo
    await expect(
      mediaService.attachProductMedia(adminCtx, {
        productId: prodRes.productId,
        kind: "video_embed",
        embedUrl: "https://evil.example.com/exploit",
        alt: "",
        position: 2,
      }),
    ).rejects.toThrow(AppError);

    const attachVideoRes = await mediaService.attachProductMedia(adminCtx, {
      productId: prodRes.productId,
      kind: "video_embed",
      embedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      alt: "",
      position: 2,
    });
    expect(attachVideoRes.productMedia.length).toBe(3);

    // 5. Reorder product media
    const ids = attachVideoRes.productMedia.map((m) => m.id);
    const reversedIds = [...ids].reverse();
    const reordered = await mediaService.reorderProductMedia(adminCtx, {
      productId: prodRes.productId,
      productMediaIds: reversedIds,
    });
    expect(reordered.productMedia[0]?.id).toBe(reversedIds[0]);

    // 6. Detach product media
    const detached = await mediaService.detachProductMedia(adminCtx, {
      productId: prodRes.productId,
      productMediaId: reversedIds[0]!,
    });
    expect(detached.productMedia.length).toBe(2);
  });
});
