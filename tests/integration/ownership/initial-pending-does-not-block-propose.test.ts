import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { ownershipService } from "@/modules/ownership/service";
import { catalogService } from "@/modules/catalog/service";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin, createPartner } from "../../factories/users";

describe("BUG-041: auto-created initial ownership (no approval request) must not block real proposals", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("lets an admin propose a real split after a partner-created product auto-assigns v1 pending ownership", async () => {
    await truncateAll();

    const admin = await createAdmin();
    // Second admin to fulfill FR-ADM-12 (approvals need at least 2 active admins)
    await createAdmin();
    const partner = await createPartner();

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["admin"],
    });

    // Creating with ctx.partnerId set auto-assigns a v1 "pending" ownership
    // row with no approvalRequestId (100% to the creator) - this must not
    // count as an in-review proposal that blocks later real proposals.
    const partnerCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-partner" },
      roles: ["admin"],
      partnerId: partner.id,
    });

    const product = await catalogService.createProduct(partnerCtx, {
      name: "Initial Pending Guard Product",
      slug: "initial-pending-guard-product",
      shortDescription: "Product to test initial pending row doesn't block real proposals",
    });

    const result = await ownershipService.proposeOwnership(adminCtx, {
      productId: product.productId,
      companyCutBps: 0,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    expect(result.ownershipId).toBeTruthy();
    expect(result.approvalRequestId).toBeTruthy();
  });
});
