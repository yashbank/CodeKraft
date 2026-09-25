import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createProduct, tiptapParagraph } from "../../factories/catalog";
import { contentService } from "@/modules/content/service";
import { LANDING_CHAPTER_KEYS } from "@/modules/content/types";
import { ErrorCode } from "@/lib/errors";

describe("Landing chapters & featured products (API-CONT-01, API-CONT-02, API-CONT-09, P3.11)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("upserts landing chapters and getLandingContent returns them with rendered rich text", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-landing" },
      roles: ["admin"],
    });

    // Create chapters for each of the 5 fixed keys
    for (let i = 0; i < LANDING_CHAPTER_KEYS.length; i++) {
      const key = LANDING_CHAPTER_KEYS[i]!;
      await contentService.upsertLandingChapter(adminCtx, {
        key,
        title: `Chapter ${key.toUpperCase()}`,
        subtitle: `Subtitle for ${key}`,
        bodyJson: tiptapParagraph(`This is the body content for chapter ${key}.`) as any,
        media: { sceneVariant: `scene-${key}` },
        cta: {
          primary: { label: `Explore ${key}`, href: `/${key}` },
        },
        position: i,
        published: true,
      });
    }

    // Public getLandingContent query returns all 5 chapters with rendered HTML
    const landing = await contentService.getLandingContent({} as any);
    expect(landing.chapters.length).toBe(5);

    for (const key of LANDING_CHAPTER_KEYS) {
      const chapter = landing.chapters.find((c) => c.key === key);
      expect(chapter).toBeDefined();
      expect(chapter?.title).toBe(`Chapter ${key.toUpperCase()}`);
      expect(chapter?.html).toContain(`This is the body content for chapter ${key}.`);
      expect(chapter?.cta?.primary.href).toBe(`/${key}`);
    }

    expect(landing.jsonLd["@type"]).toBeUndefined(); // It's @graph
    expect(landing.jsonLd["@graph"]).toBeDefined();
  });

  it("setFeaturedProducts accepts published products up to 8", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-feat" },
      roles: ["admin"],
    });

    const p1 = await createProduct({ createdBy: admin.id, status: "published" });
    const p2 = await createProduct({ createdBy: admin.id, status: "published" });

    const res = await contentService.setFeaturedProducts(adminCtx, {
      productIds: [p1.id, p2.id],
    });

    expect(res.featured.length).toBe(2);
    expect(res.featured[0]?.productId).toBe(p1.id);
    expect(res.featured[0]?.position).toBe(0);
    expect(res.featured[1]?.productId).toBe(p2.id);
    expect(res.featured[1]?.position).toBe(1);
  });

  it("setFeaturedProducts rejects unpublished product with VALIDATION error", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-feat-unpub" },
      roles: ["admin"],
    });

    const pPub = await createProduct({ createdBy: admin.id, status: "published" });
    const pDraft = await createProduct({ createdBy: admin.id, status: "draft" });

    await expect(
      contentService.setFeaturedProducts(adminCtx, {
        productIds: [pPub.id, pDraft.id],
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION,
    });
  });

  it("setFeaturedProducts rejects > 8 products with VALIDATION error", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-feat-cap" },
      roles: ["admin"],
    });

    const nineIds = Array.from({ length: 9 }, (_, i) => `11111111-1111-4111-8111-11111111111${i}`);

    await expect(
      contentService.setFeaturedProducts(adminCtx, {
        productIds: nineIds,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION,
    });
  });
});
