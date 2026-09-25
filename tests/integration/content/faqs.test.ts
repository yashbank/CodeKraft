import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin } from "../../factories/users";
import { createProduct, tiptapParagraph } from "../../factories/catalog";
import { contentService } from "@/modules/content/service";
import { ErrorCode } from "@/lib/errors";

describe("FAQs operations (API-CONT-07, API-CONT-09, P3.11)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("handles site-scoped and product-scoped FAQs with validation and ordering", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-faq" },
      roles: ["admin"],
    });

    const product = await createProduct({ createdBy: admin.id });

    // 1. Site-scoped FAQ
    const siteFaq = await contentService.upsertFaq(adminCtx, {
      question: "How does billing work?",
      answerJson: tiptapParagraph("We bill via Stripe or Razorpay.") as any,
      scope: "site",
      position: 0,
      published: true,
    });
    expect(siteFaq.faq.id).toBeDefined();

    // 2. Product-scoped FAQ without productId fails validation
    await expect(
      contentService.upsertFaq(adminCtx, {
        question: "Can I self-host this?",
        answerJson: tiptapParagraph("Yes, docker-compose is included.") as any,
        scope: "product",
        position: 0,
        published: true,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION,
    });

    // 3. Product-scoped FAQ with valid productId succeeds
    const prodFaq = await contentService.upsertFaq(adminCtx, {
      question: "Can I self-host this product?",
      answerJson: tiptapParagraph("Yes, docker-compose is included.") as any,
      scope: "product",
      productId: product.id,
      position: 0,
      published: true,
    });
    expect(prodFaq.faq.id).toBeDefined();

    // 4. Public listFaqs
    const siteFaqs = await contentService.listFaqs({} as any, { scope: "site" });
    expect(siteFaqs.length).toBe(1);
    expect(siteFaqs[0]?.question).toBe("How does billing work?");
    expect(siteFaqs[0]?.html).toContain("We bill via Stripe or Razorpay.");

    const productFaqs = await contentService.listFaqs({} as any, {
      scope: "product",
      productSlug: product.slug,
    });
    expect(productFaqs.length).toBe(1);
    expect(productFaqs[0]?.question).toBe("Can I self-host this product?");
  });
});
