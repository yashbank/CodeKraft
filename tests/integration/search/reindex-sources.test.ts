import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createProduct, tiptapParagraph } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { contentService } from "@/modules/content/service";
import { searchService } from "@/modules/search/service";
import { knowledgeChunks } from "../../../drizzle/schema/chat";
import { toFactoryDb } from "../../factories/context";

describe("Knowledge Reindex Across All Sources (PHASE-03 P3.13, docs/04 §9, API-CHAT-13)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("indexes products, offerings, services, FAQs, legal pages, and case studies <= 1200 chars", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-reindex-all" },
      roles: ["admin"],
    });

    const drizzleDb = toFactoryDb();

    // 1. Product (published)
    const product = await createProduct({
      name: "Cloud Architecture Blueprint",
      description:
        "A comprehensive guide to scaling high-throughput enterprise SaaS backends on Kubernetes.",
      status: "published",
      createdBy: admin.id,
    });

    // 2. Offering (active on published product)
    await createOffering({
      productId: product.id,
      name: "Enterprise Production License",
      status: "active",
    });

    // 3. Service (published)
    await contentService.upsertService(adminCtx, {
      slug: "cloud-devops-consulting",
      title: "Cloud & DevOps Architecture Consulting",
      summary: "End-to-end Terraform and multi-region AWS setup for high reliability.",
      bodyJson: tiptapParagraph(
        "Full architecture review and CI/CD automation pipeline setup.",
      ) as any,
      deliverables: ["Terraform scripts", "Monitoring alerts", "Architecture diagram"],
      icon: "cloud",
      position: 1,
      published: true,
    });

    // 4. FAQ (site-scoped, published)
    await contentService.upsertFaq(adminCtx, {
      question: "What SLA guarantees are provided?",
      answerJson: tiptapParagraph("We guarantee 99.95% uptime on enterprise tier support.") as any,
      scope: "site",
      position: 1,
      published: true,
    });

    // 5. Legal page (published)
    await contentService.updateLegalPage(adminCtx, {
      key: "privacy",
      title: "Privacy Policy",
      bodyJson: tiptapParagraph(
        "We never sell customer telemetry data and strictly adhere to GDPR standards.",
      ) as any,
    });
    await contentService.publishLegalPage(adminCtx, { key: "privacy" });

    // 6. Case study (published)
    const caseStudy = await contentService.upsertCaseStudy(adminCtx, {
      slug: "fintech-migration-scale",
      title: "Zero-Downtime Database Migration for Global FinTech",
      clientName: "Apex Capital",
      industry: "Financial Services",
      problemJson: tiptapParagraph(
        "Legacy monolith caused latency spikes during market open.",
      ) as any,
      solutionJson: tiptapParagraph(
        "Migrated to distributed PostgreSQL with streaming logical replication.",
      ) as any,
      resultsJson: tiptapParagraph(
        "Reduced p99 latency by 85% and eliminated failover outages.",
      ) as any,
      techStack: ["PostgreSQL", "Next.js", "Redis"],
    });
    await contentService.publishCaseStudy(adminCtx, { id: caseStudy.caseStudy.id });

    // Run reindex for all sources
    const result = await searchService.reindex();
    expect(result.chunks).toBeGreaterThanOrEqual(6);

    // Verify knowledge_chunks in database
    const rows = await drizzleDb.select().from(knowledgeChunks);
    expect(rows.length).toBeGreaterThanOrEqual(6);

    const sourceTypes = new Set(rows.map((r) => r.sourceType));
    expect(sourceTypes.has("product")).toBe(true);
    expect(sourceTypes.has("offering")).toBe(true);
    expect(sourceTypes.has("service")).toBe(true);
    expect(sourceTypes.has("faq")).toBe(true);
    expect(sourceTypes.has("legal")).toBe(true);
    expect(sourceTypes.has("case_study")).toBe(true);

    // Verify all chunks respect character limit <= 1200
    for (const row of rows) {
      expect(row.body.length).toBeLessThanOrEqual(1200);
      expect(row.title).toBeTruthy();
    }
  });
});
