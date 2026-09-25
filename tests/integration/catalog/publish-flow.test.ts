import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { catalogService } from "@/modules/catalog/service";
import { db } from "@/lib/db";
import { products, productMedia } from "../../../drizzle/schema/catalog";
import { ErrorCode } from "@/lib/errors";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin, createPartner } from "../../factories/users";
import { createOwnership } from "../../factories/ownership";
import { createOffering } from "../../factories/offerings";
import { createMedia } from "../../factories/catalog";

describe("catalog product publish flow & lifecycle (FR-ADM-05, API-CAT-11..13, P3.9)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  async function createPublishReadyProduct(requesterId: string) {
    const requesterCtx = buildContext({
      user: { id: requesterId },
      session: { id: "sess-ready" },
      roles: ["admin"],
    });

    // 1. Create product
    const { productId } = await catalogService.createProduct(requesterCtx, {
      name: "Publish Ready Product",
      slug: `ready-prod-${Date.now()}`,
      shortDescription: "A ready product",
    });

    // 2. Partner & Ownership
    const partner = await createPartner({ userId: requesterId });
    await createOwnership({
      productId,
      createdBy: requesterId,
      status: "active",
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    // 3. Active Offering with base price and payment method
    await createOffering({
      productId,
      status: "active",
      price: { amountMinor: 99900, currency: "INR" },
      methods: ["manual_upi"],
    });

    // 4. Media item
    const mediaRow = await createMedia({ uploadedBy: requesterId });
    await db.insert(productMedia).values({
      productId,
      kind: "image",
      mediaId: mediaRow.id,
      alt: "Product cover",
    });

    return productId;
  }

  it("fails submitForApproval if readiness requirements are not met", async () => {
    await truncateAll();
    const requester = await createAdmin();
    await createAdmin(); // Second admin for approval requirements

    const requesterCtx = buildContext({
      user: { id: requester.id },
      session: { id: "sess-req-not-ready" },
      roles: ["admin"],
    });

    // Empty product with no offerings, images, or ownership
    const { productId } = await catalogService.createProduct(requesterCtx, {
      name: "Bare Product",
      slug: "bare-product",
      shortDescription: "Incomplete product",
    });

    await expect(
      catalogService.submitForApproval(requesterCtx, { productId }),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: ErrorCode.VALIDATION,
      }),
    );
  });

  it("completes full publish approval flow: submit -> approve -> published, and unpublish", async () => {
    await truncateAll();
    const requester = await createAdmin();
    const approver = await createAdmin();

    const requesterCtx = buildContext({
      user: { id: requester.id },
      session: { id: "sess-req-pub" },
      roles: ["admin"],
    });

    const approverCtx = buildContext({
      user: { id: approver.id },
      session: { id: "sess-appr-pub" },
      roles: ["admin"],
    });

    const productId = await createPublishReadyProduct(requester.id);

    // 1. Submit for approval
    const { approvalRequestId } = await catalogService.submitForApproval(requesterCtx, {
      productId,
    });
    expect(approvalRequestId).toBeDefined();

    // Verify product status is pending_approval
    const [prodPending] = await db.select().from(products).where(eq(products.id, productId));
    expect(prodPending?.status).toBe("pending_approval");

    // 2. Approver approves request
    const approvalRes = await approvalsService.approveRequest(approverCtx, {
      approvalRequestId,
      comment: "Approved for publishing",
    });
    expect(approvalRes.status).toBe("applied");

    // Verify product status is published with publishedAt set
    const [prodPublished] = await db.select().from(products).where(eq(products.id, productId));
    expect(prodPublished?.status).toBe("published");
    expect(prodPublished?.publishedAt).toBeDefined();

    // 3. Unpublish product directly (API-CAT-13)
    const { product: unpublished } = await catalogService.unpublishProduct(requesterCtx, {
      productId,
      reason: "Updating launch assets",
    });
    expect(unpublished.status).toBe("unpublished");
  });

  it("reverts product to draft on rejection", async () => {
    await truncateAll();
    const requester = await createAdmin();
    const rejecter = await createAdmin();

    const requesterCtx = buildContext({
      user: { id: requester.id },
      session: { id: "sess-req-rej" },
      roles: ["admin"],
    });

    const rejecterCtx = buildContext({
      user: { id: rejecter.id },
      session: { id: "sess-rej-pub" },
      roles: ["admin"],
    });

    const productId = await createPublishReadyProduct(requester.id);

    const { approvalRequestId } = await catalogService.submitForApproval(requesterCtx, {
      productId,
    });

    // Reject the request
    await approvalsService.rejectRequest(rejecterCtx, {
      approvalRequestId,
      comment: "Pricing and copy need rework",
    });

    // Product reverts back to draft
    const [prodDraft] = await db.select().from(products).where(eq(products.id, productId));
    expect(prodDraft?.status).toBe("draft");
  });
});
