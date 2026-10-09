import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createMedia, tiptapParagraph } from "../../factories/catalog";
import { contentService } from "@/modules/content/service";

describe("Admin case-study cover / client-logo media round-trip", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("persists coverMediaId and logo mediaId and returns them (with urls) in admin lists", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const ctx = buildContext({ user: { id: admin.id }, session: { id: "s-am" }, roles: ["admin"] });
    const cover = await createMedia();
    const logoMedia = await createMedia();

    await contentService.upsertCaseStudy(ctx, {
      slug: `cs-${Date.now()}`,
      title: "Cover test",
      problemJson: tiptapParagraph("p") as any,
      solutionJson: tiptapParagraph("s") as any,
      resultsJson: tiptapParagraph("r") as any,
      clientName: "C",
      industry: "I",
      techStack: [],
      coverMediaId: cover.id,
    });
    const cs = (await contentService.listCaseStudiesAdmin(ctx))[0]!;
    expect(cs.coverMediaId).toBe(cover.id);
    expect(cs.coverUrl).toBeTruthy();

    await contentService.upsertClientLogo(ctx, {
      name: "Acme",
      mediaId: logoMedia.id,
      position: 0,
      published: true,
    } as any);
    const logo = (await contentService.listClientLogosAdmin(ctx))[0]!;
    expect(logo.mediaId).toBe(logoMedia.id);
    expect(logo.logoUrl).toBeTruthy();
  });
});
