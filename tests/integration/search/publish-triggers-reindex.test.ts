import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createProduct, tiptapParagraph } from "../../factories/catalog";
import { contentService } from "@/modules/content/service";
import { catalogService } from "@/modules/catalog/service";
import { searchService } from "@/modules/search/service";
import { knowledgeChunks } from "../../../drizzle/schema/chat";
import { and, eq } from "drizzle-orm";
import { toFactoryDb } from "../../factories/context";

describe("Publish Triggers Knowledge Reindex & Lifecycle (PHASE-03 P3.13, docs/04 §9)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("publishing a case study creates chunks, unpublishing removes them", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-pub-cs" },
      roles: ["admin"],
    });
    const drizzleDb = toFactoryDb();

    // 1. Create unpublished case study
    const csRes = await contentService.upsertCaseStudy(adminCtx, {
      slug: "cloud-native-transformation",
      title: "Enterprise Cloud-Native Transformation",
      clientName: "Global Logistics Inc",
      industry: "Logistics",
      problemJson: tiptapParagraph(
        "Legacy datacenter costs were growing 40% year over year.",
      ) as any,
      solutionJson: tiptapParagraph(
        "Migrated 120 services to modern containerized microservices.",
      ) as any,
      resultsJson: tiptapParagraph(
        "Cut annual hosting expenses by $1.4M and reduced deploy times to 15m.",
      ) as any,
      techStack: ["Kubernetes", "Golang", "Postgres"],
    });

    // Before publish: no chunks
    let chunks = await drizzleDb
      .select()
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.sourceType, "case_study"),
          eq(knowledgeChunks.sourceId, csRes.caseStudy.id),
        ),
      );
    expect(chunks).toHaveLength(0);

    // 2. Publish case study: triggers reindex
    await contentService.publishCaseStudy(adminCtx, { id: csRes.caseStudy.id });

    chunks = await drizzleDb
      .select()
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.sourceType, "case_study"),
          eq(knowledgeChunks.sourceId, csRes.caseStudy.id),
        ),
      );
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]?.title).toContain("Enterprise Cloud-Native Transformation");

    // 3. Unpublish case study: chunks are immediately removed
    await contentService.unpublishCaseStudy(adminCtx, { id: csRes.caseStudy.id });

    chunks = await drizzleDb
      .select()
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.sourceType, "case_study"),
          eq(knowledgeChunks.sourceId, csRes.caseStudy.id),
        ),
      );
    expect(chunks).toHaveLength(0);
  });

  it("unpublishing a product removes its indexed chunks", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-pub-prod" },
      roles: ["admin"],
    });
    const drizzleDb = toFactoryDb();

    // Create published product and index it
    const product = await createProduct({
      name: "DevOps Accelerator Kit",
      description: "Production-ready CI/CD templates and infrastructure as code.",
      status: "published",
      createdBy: admin.id,
    });

    await searchService.reindex("product");

    let chunks = await drizzleDb
      .select()
      .from(knowledgeChunks)
      .where(
        and(eq(knowledgeChunks.sourceType, "product"), eq(knowledgeChunks.sourceId, product.id)),
      );
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    // Unpublish product
    await catalogService.unpublishProduct(adminCtx, {
      productId: product.id,
      reason: "Product decommissioned for overhaul",
    });

    chunks = await drizzleDb
      .select()
      .from(knowledgeChunks)
      .where(
        and(eq(knowledgeChunks.sourceType, "product"), eq(knowledgeChunks.sourceId, product.id)),
      );
    expect(chunks).toHaveLength(0);
  });
});
