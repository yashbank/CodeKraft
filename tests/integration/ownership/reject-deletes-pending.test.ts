import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { ownershipService } from "@/modules/ownership/service";
import { catalogService } from "@/modules/catalog/service";
import { db } from "@/lib/db";
import { productOwnerships, productOwnershipLines } from "../../../drizzle/schema/ownership";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin, createPartner } from "../../factories/users";

describe("ownership rejection: reject deletes pending version (API-ADM-03, P3.8)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("deletes the pending version and its lines when approval request is rejected", async () => {
    await truncateAll();

    const requester = await createAdmin();
    const rejecter = await createAdmin();
    const partner = await createPartner();

    const requesterCtx = buildContext({
      user: { id: requester.id },
      session: { id: "sess-req-rej" },
      roles: ["admin"],
    });

    const rejecterCtx = buildContext({
      user: { id: rejecter.id },
      session: { id: "sess-rej" },
      roles: ["admin"],
    });

    const product = await catalogService.createProduct(requesterCtx, {
      name: "Reject Test Product",
      slug: "reject-test-product",
      shortDescription: "Product testing rejection cleanup",
    });

    const proposeRes = await ownershipService.proposeOwnership(requesterCtx, {
      productId: product.productId,
      companyCutBps: 1000,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    // Verify pending exists
    const [pendingBefore] = await db
      .select()
      .from(productOwnerships)
      .where(eq(productOwnerships.id, proposeRes.ownershipId));
    expect(pendingBefore).toBeDefined();

    // Reject the request with comment
    await approvalsService.rejectRequest(rejecterCtx, {
      approvalRequestId: proposeRes.approvalRequestId,
      comment: "Split does not align with agreement",
    });

    // Verify pending ownership is deleted
    const [pendingAfter] = await db
      .select()
      .from(productOwnerships)
      .where(eq(productOwnerships.id, proposeRes.ownershipId));
    expect(pendingAfter).toBeUndefined();

    // Verify lines are also gone
    const linesAfter = await db
      .select()
      .from(productOwnershipLines)
      .where(eq(productOwnershipLines.ownershipId, proposeRes.ownershipId));
    expect(linesAfter).toHaveLength(0);
  });
});
