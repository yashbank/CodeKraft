import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createMedia, tiptapParagraph } from "../../factories/catalog";
import { contentService } from "@/modules/content/service";
import { slugRedirects } from "../../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { toFactoryDb } from "../../factories/context";
import { ErrorCode } from "@/lib/errors";

describe("Case studies lifecycle & slug redirects (API-CONT-04, API-CONT-09, P3.11)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("handles case study CRUD, publishing, and slug redirects", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-cs" },
      roles: ["admin"],
    });

    const cover = await createMedia();
    const slug1 = `case-study-1-${Date.now()}`;
    const slug2 = `case-study-updated-${Date.now()}`;

    // 1. Create draft case study
    const res1 = await contentService.upsertCaseStudy(adminCtx, {
      slug: slug1,
      title: "FinTech Migration to Next.js",
      clientName: "FinCorp",
      industry: "FinTech",
      problemJson: tiptapParagraph("Legacy monolithic system was slow.") as any,
      solutionJson: tiptapParagraph("Migrated to Next.js and Postgres.") as any,
      resultsJson: tiptapParagraph("99.9% uptime and 4x faster load.") as any,
      techStack: ["Next.js", "TypeScript", "PostgreSQL"],
      coverMediaId: cover.id,
      gallery: [],
      seoTitle: "FinTech Case Study",
      seoDescription: "How we migrated FinCorp to Next.js",
    });

    expect(res1.caseStudy.id).toBeDefined();
    expect(res1.caseStudy.published).toBe(false);

    // Draft is not visible in public queries
    await expect(
      contentService.getCaseStudyBySlug({} as any, { slug: slug1 }),
    ).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });

    // 2. Publish case study
    const pubRes = await contentService.publishCaseStudy(adminCtx, { id: res1.caseStudy.id });
    expect(pubRes.caseStudy.published).toBe(true);
    expect(pubRes.caseStudy.publishedAt).toBeDefined();

    // Now accessible in public query
    const publicDetail = await contentService.getCaseStudyBySlug({} as any, { slug: slug1 });
    expect(publicDetail.title).toBe("FinTech Migration to Next.js");
    expect(publicDetail.problemHtml).toContain("Legacy monolithic system was slow.");
    expect(publicDetail.jsonLd["@type"]).toBe("Article");

    // 3. Update slug on published case study -> records 301 redirect
    await contentService.upsertCaseStudy(adminCtx, {
      id: res1.caseStudy.id,
      slug: slug2,
      title: "FinTech Migration to Next.js (Updated)",
      clientName: "FinCorp",
      industry: "FinTech",
      problemJson: tiptapParagraph("Legacy monolithic system was slow.") as any,
      solutionJson: tiptapParagraph("Migrated to Next.js and Postgres.") as any,
      resultsJson: tiptapParagraph("99.9% uptime and 4x faster load.") as any,
      techStack: ["Next.js", "TypeScript", "PostgreSQL"],
      coverMediaId: cover.id,
      gallery: [],
    });

    // Check slug_redirects
    const drizzleDb = toFactoryDb();
    const [redir] = await drizzleDb
      .select()
      .from(slugRedirects)
      .where(
        and(
          eq(slugRedirects.entity, "case_study"),
          eq(slugRedirects.oldSlug, slug1),
          eq(slugRedirects.newSlug, slug2),
        ),
      );

    expect(redir).toBeDefined();

    // Querying with old slug resolves to updated case study
    const resolvedViaOldSlug = await contentService.getCaseStudyBySlug({} as any, {
      slug: slug1,
    });
    expect(resolvedViaOldSlug.slug).toBe(slug2);
    expect(resolvedViaOldSlug.title).toBe("FinTech Migration to Next.js (Updated)");

    // 4. Unpublish
    const unpubRes = await contentService.unpublishCaseStudy(adminCtx, { id: res1.caseStudy.id });
    expect(unpubRes.caseStudy.published).toBe(false);

    // No longer accessible in public query
    await expect(
      contentService.getCaseStudyBySlug({} as any, { slug: slug2 }),
    ).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });
});
