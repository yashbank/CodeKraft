import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createProduct, tiptapParagraph } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { contentService } from "@/modules/content/service";
import { searchService } from "@/modules/search/service";

describe("Knowledge Retrieval & Ranking (PHASE-03 P3.13, docs/04 §9, FR-CHAT-06)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("retrieves <= 8 ranked chunks with valid source references and hrefs", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-ret-rank" },
      roles: ["admin"],
    });

    // 1. Seed Product
    const product = await createProduct({
      slug: "ai-code-auditor",
      name: "AI Code Auditor Pro",
      description:
        "Automated static analysis, AST linting, and vulnerability scanning for TypeScript and Rust.",
      status: "published",
      createdBy: admin.id,
    });

    // 2. Seed Offering
    await createOffering({
      productId: product.id,
      name: "Team Plan",
      status: "active",
    });

    // 3. Seed Service
    await contentService.upsertService(adminCtx, {
      slug: "security-audits",
      title: "Full-Stack Security & Compliance Audits",
      summary: "Manual penetration testing and smart contract verification.",
      bodyJson: tiptapParagraph(
        "We assess AST vulnerabilities, secrets leakage, and compliance.",
      ) as any,
      deliverables: ["Audit report", "Remediation PRs"],
      icon: "shield",
      position: 1,
      published: true,
    });

    // 4. Seed FAQ
    await contentService.upsertFaq(adminCtx, {
      question: "Does the auditor detect SQL injections?",
      answerJson: tiptapParagraph(
        "Yes, our static analysis engine flags all unparameterized SQL queries.",
      ) as any,
      scope: "site",
      position: 1,
      published: true,
    });

    // 5. Seed Legal
    await contentService.updateLegalPage(adminCtx, {
      key: "terms",
      title: "Terms and Security Conditions",
      bodyJson: tiptapParagraph(
        "Security findings must be reported in accordance with responsible disclosure.",
      ) as any,
    });
    await contentService.publishLegalPage(adminCtx, { key: "terms" });

    // 6. Seed Case Study
    const cs = await contentService.upsertCaseStudy(adminCtx, {
      slug: "fintech-audit-success",
      title: "Audit Automation for Payment Processing",
      clientName: "PayCo Global",
      industry: "Financial Services",
      problemJson: tiptapParagraph(
        "Frequent vulnerabilities blocked compliance audit signoff.",
      ) as any,
      solutionJson: tiptapParagraph(
        "Integrated automated code auditor into GitHub Actions.",
      ) as any,
      resultsJson: tiptapParagraph(
        "Passed SOC-2 Type II audit in 30 days without critical findings.",
      ) as any,
      techStack: ["Node.js", "Docker"],
    });
    await contentService.publishCaseStudy(adminCtx, { id: cs.caseStudy.id });

    // Reindex everything
    await searchService.reindex();

    // Query for "vulnerability audit"
    const results = await searchService.retrieve("vulnerability audit", 8);

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(8);

    // Verify properties of top chunk
    const top = results[0]!;
    expect(top.chunkId).toBeDefined();
    expect(top.title).toBeTruthy();
    expect(top.body).toBeTruthy();
    expect(top.href).toBeTruthy();
    expect(top.rank).toBeGreaterThan(0);

    // Check href mapping conventions
    const productChunk = results.find((r) => r.sourceType === "product");
    if (productChunk) {
      expect(productChunk.href).toBe("/products/ai-code-auditor");
    }

    const serviceChunk = results.find((r) => r.sourceType === "service");
    if (serviceChunk) {
      expect(serviceChunk.href).toBe("/services#security-audits");
    }

    const faqChunk = results.find((r) => r.sourceType === "faq");
    if (faqChunk) {
      expect(faqChunk.href).toBe("/faq");
    }

    const legalChunk = results.find((r) => r.sourceType === "legal");
    if (legalChunk) {
      expect(legalChunk.href).toBe("/legal/terms");
    }

    const caseStudyChunk = results.find((r) => r.sourceType === "case_study");
    if (caseStudyChunk) {
      expect(caseStudyChunk.href).toBe("/case-studies/fintech-audit-success");
    }
  });
});
