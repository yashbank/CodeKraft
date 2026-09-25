import { beforeAll, describe, expect, it } from "vitest";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createProduct, tiptapParagraph } from "../../factories/catalog";
import { createAdmin } from "../../factories/users";
import { knowledgeReindexJob } from "@/jobs/knowledge";
import { jobRuns } from "../../../drizzle/schema/ops";
import { eq, desc } from "drizzle-orm";
import { toFactoryDb } from "../../factories/context";
import { contentService } from "@/modules/content/service";
import { buildContext } from "@/lib/authz/context";
import { knowledgeChunks } from "../../../drizzle/schema/chat";

describe("knowledge.reindex Job (PHASE-03 P3.13, docs/06 §3.3)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("runs full reindex, records job_run with status ok, and writes chunks", async () => {
    await truncateAll();
    const admin = await createAdmin();

    // Seed a published product
    await createProduct({
      name: "Serverless API Gateway",
      description: "Auto-scaling REST and GraphQL gateway for modern SaaS architectures.",
      status: "published",
      createdBy: admin.id,
    });

    const drizzleDb = toFactoryDb();

    const result = await knowledgeReindexJob.run(new Date("2026-09-26T04:00:00Z"));

    expect(result.chunks).toBeGreaterThanOrEqual(1);

    // Verify job_runs entry
    const [run] = await drizzleDb
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.job, "knowledge.reindex"))
      .orderBy(desc(jobRuns.finishedAt))
      .limit(1);

    expect(run).toBeDefined();
    expect(run?.status).toBe("ok");
    expect((run?.detail as any)?.chunks).toBeGreaterThanOrEqual(1);
  });

  it("is idempotent — running twice yields same chunk count (stale rows replaced)", async () => {
    await truncateAll();
    const admin = await createAdmin();

    await createProduct({
      name: "AI Reasoning Engine",
      description: "On-device inference for constrained edge deployments.",
      status: "published",
      createdBy: admin.id,
    });

    const drizzleDb = toFactoryDb();

    const first = await knowledgeReindexJob.run(new Date("2026-09-26T04:00:00Z"));
    const second = await knowledgeReindexJob.run(new Date("2026-09-26T04:01:00Z"));

    expect(second.chunks).toBe(first.chunks);

    const rows = await drizzleDb.select().from(knowledgeChunks);
    expect(rows.length).toBe(first.chunks);
  });

  it("can reindex a single source type without affecting others", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-job-single" },
      roles: ["admin"],
    });

    await createProduct({
      name: "Observability Platform",
      description: "Distributed tracing, metrics, and anomaly detection.",
      status: "published",
      createdBy: admin.id,
    });

    await contentService.upsertFaq(adminCtx, {
      question: "How do you handle data retention?",
      answerJson: tiptapParagraph("Data is retained for 90 days in compliance with GDPR.") as any,
      scope: "site",
      position: 1,
      published: true,
    });

    // Full reindex
    await knowledgeReindexJob.run(new Date());

    const drizzleDb = toFactoryDb();

    // Reindex only FAQs
    const partialResult = await knowledgeReindexJob.run(new Date(), { sourceType: "faq" });

    const afterChunks = await drizzleDb.select().from(knowledgeChunks);

    // Product chunks should remain untouched
    const productChunks = afterChunks.filter((c) => c.sourceType === "product");
    expect(productChunks.length).toBeGreaterThanOrEqual(1);

    // FAQ chunks should be exactly what reindex rebuilt
    const faqChunks = afterChunks.filter((c) => c.sourceType === "faq");
    expect(faqChunks.length).toBeGreaterThanOrEqual(1);

    expect(partialResult.chunks).toBe(faqChunks.length);
  });
});
