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
import { createOwnership } from "../../factories/ownership";

describe("ownership dual approval lifecycle: propose -> approve -> apply (PHASE-03 P3.8)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("completes full flow: propose creates approval request; approve activates n+1 version and supersedes previous", async () => {
    await truncateAll();

    const requester = await createAdmin();
    const approver = await createAdmin();

    const requesterCtx = buildContext({
      user: { id: requester.id },
      session: { id: "sess-req" },
      roles: ["admin"],
    });

    const approverCtx = buildContext({
      user: { id: approver.id },
      session: { id: "sess-appr" },
      roles: ["admin"],
    });

    // 1. Create a product first (before creating partner row, so it doesn't auto-create a pending ownership)
    const product = await catalogService.createProduct(requesterCtx, {
      name: "Ownership Test Product",
      slug: "ownership-test-product",
      shortDescription: "A product testing ownership lifecycle",
    });

    // 2. Associate partner profiles for requester and approver (keeping total admin count = 2)
    const partnerA = await createPartner({ userId: requester.id });
    const partnerB = await createPartner({ userId: approver.id });

    // 3. Create initial active v1 ownership
    const v1 = await createOwnership({
      productId: product.productId,
      version: 1,
      status: "active",
      companyCutBps: 0,
      createdBy: requester.id,
      lines: [{ partnerId: partnerA.id, shareBps: 10000 }],
    });
    expect(v1).toBeDefined();
    expect(v1.version).toBe(1);
    expect(v1.status).toBe("active");

    // 4. Propose new ownership v2 (lines sum to 10,000 bps)
    const proposeRes = await ownershipService.proposeOwnership(requesterCtx, {
      productId: product.productId,
      companyCutBps: 2000,
      lines: [
        { partnerId: partnerA.id, shareBps: 6000 },
        { partnerId: partnerB.id, shareBps: 4000 },
      ],
    });

    expect(proposeRes.ownershipId).toBeDefined();
    expect(proposeRes.approvalRequestId).toBeDefined();

    // Verify v2 is pending
    const [v2Pending] = await db
      .select()
      .from(productOwnerships)
      .where(eq(productOwnerships.id, proposeRes.ownershipId));
    expect(v2Pending).toBeDefined();
    expect(v2Pending!.status).toBe("pending");
    expect(v2Pending!.version).toBe(2);

    // 5. Approver approves the request
    const approvalResult = await approvalsService.approveRequest(approverCtx, {
      approvalRequestId: proposeRes.approvalRequestId,
      comment: "Approved ownership split",
    });

    expect(approvalResult.status).toBe("applied");
    expect(approvalResult.applied).toBe(true);

    // 6. Verify v1 is superseded and v2 is active
    const [v1After] = await db
      .select()
      .from(productOwnerships)
      .where(eq(productOwnerships.id, v1.id));
    expect(v1After).toBeDefined();
    expect(v1After!.status).toBe("superseded");

    const [v2After] = await db
      .select()
      .from(productOwnerships)
      .where(eq(productOwnerships.id, proposeRes.ownershipId));
    expect(v2After).toBeDefined();
    expect(v2After!.status).toBe("active");
    expect(v2After!.effectiveFrom).toBeDefined();

    // Verify lines of v2
    const v2Lines = await db
      .select()
      .from(productOwnershipLines)
      .where(eq(productOwnershipLines.ownershipId, proposeRes.ownershipId));
    expect(v2Lines).toHaveLength(2);
    const partnerAShare = v2Lines.find((l) => l.partnerId === partnerA.id);
    expect(partnerAShare?.shareBps).toBe(6000);
  });
});
