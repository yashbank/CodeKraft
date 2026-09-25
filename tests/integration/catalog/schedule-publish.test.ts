import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { catalogService } from "@/modules/catalog/service";
import { db } from "@/lib/db";
import { products, productMedia } from "../../../drizzle/schema/catalog";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin, createPartner } from "../../factories/users";
import { createOwnership } from "../../factories/ownership";
import { createOffering } from "../../factories/offerings";
import { createMedia } from "../../factories/catalog";

describe("catalog scheduled publishing (API-CAT-11..12, D-308, P3.9)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("schedules a product for future publishing upon approval", async () => {
    await truncateAll();
    const requester = await createAdmin();
    const approver = await createAdmin();

    const requesterCtx = buildContext({
      user: { id: requester.id },
      session: { id: "sess-req-sched" },
      roles: ["admin"],
    });

    const approverCtx = buildContext({
      user: { id: approver.id },
      session: { id: "sess-appr-sched" },
      roles: ["admin"],
    });

    // 1. Create product and readiness fixtures
    const { productId } = await catalogService.createProduct(requesterCtx, {
      name: "Scheduled Product",
      slug: "scheduled-product",
      shortDescription: "Product scheduled for future release",
    });

    const partner = await createPartner({ userId: requester.id });
    await createOwnership({
      productId,
      createdBy: requester.id,
      status: "active",
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    await createOffering({
      productId,
      status: "active",
      price: { amountMinor: 50000, currency: "INR" },
      methods: ["manual_bank"],
    });

    const mediaRow = await createMedia({ uploadedBy: requester.id });
    await db.insert(productMedia).values({
      productId,
      kind: "image",
      mediaId: mediaRow.id,
      alt: "Cover image",
    });

    // 2. Submit with future date (7 days ahead)
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { approvalRequestId } = await catalogService.submitForApproval(requesterCtx, {
      productId,
      publishAt: futureDate.toISOString(),
    });

    // 3. Approver approves request
    const approvalRes = await approvalsService.approveRequest(approverCtx, {
      approvalRequestId,
      comment: "Approved scheduled release",
    });
    expect(approvalRes.status).toBe("applied");

    // 4. Verify product status is 'scheduled' with publishAt set and publishedAt null
    const [prodScheduled] = await db.select().from(products).where(eq(products.id, productId));
    expect(prodScheduled?.status).toBe("scheduled");
    expect(prodScheduled?.publishAt).toBeDefined();
    expect(prodScheduled?.publishedAt).toBeNull();
  });
});
