import { beforeAll, describe, expect, it } from "vitest";
import { anonymousContext, buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createMedia, tiptapParagraph } from "../../factories/catalog";
import { contentService } from "@/modules/content/service";

describe("Case-study gallery round-trip", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("keeps order and resolves urls in the public getter and admin list", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const ctx = buildContext({ user: { id: admin.id }, session: { id: "s-g" }, roles: ["admin"] });
    const [a, b] = [await createMedia(), await createMedia()];
    const slug = `cs-gal-${Date.now()}`;
    const saved = await contentService.upsertCaseStudy(ctx, {
      slug,
      title: "Gallery",
      problemJson: tiptapParagraph("p") as any,
      solutionJson: tiptapParagraph("s") as any,
      resultsJson: tiptapParagraph("r") as any,
      clientName: "C",
      industry: "I",
      techStack: [],
      gallery: [
        { mediaId: b.id, alt: "second-first" },
        { mediaId: a.id, alt: "first-second" },
      ],
    } as any);
    await contentService.publishCaseStudy(ctx, { id: (saved as any).caseStudy.id });

    const pub = await contentService.getCaseStudyBySlug(anonymousContext(), { slug });
    expect(pub.gallery.map((g) => g.mediaId)).toEqual([b.id, a.id]);
    expect(pub.gallery.every((g) => !!g.url)).toBe(true);

    const row = (await contentService.listCaseStudiesAdmin(ctx))[0]!;
    expect(row.gallery.map((g) => g.mediaId)).toEqual([b.id, a.id]);
    expect(row.gallery.every((g) => !!g.url)).toBe(true);
  });
});
