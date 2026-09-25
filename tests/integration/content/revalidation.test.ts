import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createMedia, createProduct, tiptapParagraph } from "../../factories/catalog";
import { contentService } from "@/modules/content/service";
import { getRevalidatedTags, resetRevalidatedTags } from "@/lib/revalidate";

describe("Content cache revalidation tags (P3.11, docs/06 §1.10)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("emits expected cache tags on content operations", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-reval" },
      roles: ["admin"],
    });

    // 1. Landing chapter
    resetRevalidatedTags();
    await contentService.upsertLandingChapter(adminCtx, {
      key: "who",
      title: "Who We Are",
      bodyJson: tiptapParagraph("About us.") as any,
      media: {},
      cta: { primary: { label: "Learn More", href: "/about" } },
      position: 0,
      published: true,
    });
    expect(getRevalidatedTags()).toContain("content");

    // 2. Featured products
    const p1 = await createProduct({ createdBy: admin.id, status: "published" });
    resetRevalidatedTags();
    await contentService.setFeaturedProducts(adminCtx, { productIds: [p1.id] });
    expect(getRevalidatedTags()).toContain("content");
    expect(getRevalidatedTags()).toContain("catalog");

    // 3. Case study
    const cover = await createMedia();
    const cs = await contentService.upsertCaseStudy(adminCtx, {
      slug: "brand-case-study",
      title: "Brand Case Study",
      clientName: "Brand Inc",
      industry: "Retail",
      problemJson: tiptapParagraph("Problem") as any,
      solutionJson: tiptapParagraph("Solution") as any,
      resultsJson: tiptapParagraph("Results") as any,
      techStack: ["React"],
      coverMediaId: cover.id,
      gallery: [],
    });

    resetRevalidatedTags();
    await contentService.publishCaseStudy(adminCtx, { id: cs.caseStudy.id });
    const tags = getRevalidatedTags();
    expect(tags).toContain("case-studies");
    expect(tags).toContain("sitemap");
    expect(tags).toContain("case-study:brand-case-study");

    // 4. Legal page
    resetRevalidatedTags();
    await contentService.updateLegalPage(adminCtx, {
      key: "privacy",
      title: "Privacy Policy",
      bodyJson: tiptapParagraph("Privacy content.") as any,
    });
    expect(getRevalidatedTags()).toContain("content");
  });
});
