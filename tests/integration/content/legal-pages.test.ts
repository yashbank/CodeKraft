import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { tiptapParagraph } from "../../factories/catalog";
import { contentService } from "@/modules/content/service";
import { legalPageVersions } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { toFactoryDb } from "../../factories/context";

describe("Legal pages versioning & history snapshot (API-CONT-08, FR-CONT-04, P3.11)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("updateLegalPage saves draft text without version bump, publishLegalPage bumps version and preserves historical snapshot", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-legal" },
      roles: ["admin"],
    });

    const drizzleDb = toFactoryDb();

    // 1. Initial draft update
    const res1 = await contentService.updateLegalPage(adminCtx, {
      key: "terms",
      title: "Terms of Service",
      bodyJson: tiptapParagraph("Version 1 initial draft.") as any,
    });

    expect(res1.page.version).toBe(1);
    expect(res1.page.publishedAt).toBeNull();

    // 2. Publish version 1
    const pubRes1 = await contentService.publishLegalPage(adminCtx, { key: "terms" });
    expect(pubRes1.page.version).toBe(1);
    expect(pubRes1.version.version).toBe(1);
    expect(pubRes1.page.publishedAt).toBeDefined();

    // 3. Update text for version 2 (draft phase, version not bumped yet)
    const updateRes2 = await contentService.updateLegalPage(adminCtx, {
      key: "terms",
      title: "Terms of Service (Revised)",
      bodyJson: tiptapParagraph("Version 2 updated draft.") as any,
    });
    expect(updateRes2.page.version).toBe(1); // Still version 1 until published

    // 4. Publish version 2 -> bumps version to 2 and snapshots historical row
    const pubRes2 = await contentService.publishLegalPage(adminCtx, { key: "terms" });
    expect(pubRes2.page.version).toBe(2);
    expect(pubRes2.version.version).toBe(2);

    // 5. Verify legal_page_versions contains BOTH version 1 and version 2 snapshots
    const historyRows = await drizzleDb
      .select()
      .from(legalPageVersions)
      .where(eq(legalPageVersions.legalPageId, pubRes2.page.id))
      .orderBy(legalPageVersions.version);

    expect(historyRows.length).toBe(2);
    expect(historyRows[0]?.version).toBe(1);
    expect(historyRows[0]?.bodyJson).toEqual(tiptapParagraph("Version 1 initial draft."));
    expect(historyRows[1]?.version).toBe(2);
    expect(historyRows[1]?.bodyJson).toEqual(tiptapParagraph("Version 2 updated draft."));

    // 6. Public getLegalPage returns current published version with rendered HTML
    const publicPage = await contentService.getLegalPage({} as any, { key: "terms" });
    expect(publicPage.version).toBe(2);
    expect(publicPage.title).toBe("Terms of Service (Revised)");
    expect(publicPage.html).toContain("Version 2 updated draft.");
  });
});
