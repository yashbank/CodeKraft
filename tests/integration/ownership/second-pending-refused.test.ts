import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { ownershipService } from "@/modules/ownership/service";
import { catalogService } from "@/modules/catalog/service";
import { ErrorCode } from "@/lib/errors";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin, createPartner } from "../../factories/users";

describe("ownership state guard: second pending proposal refused (API-CAT-16, P3.8)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("throws STATE_INVALID if another proposal is already pending for the product", async () => {
    await truncateAll();

    const admin = await createAdmin();
    // Second admin to fulfill FR-ADM-12 (approvals need at least 2 active admins)
    await createAdmin();
    const partner = await createPartner();

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-concur" },
      roles: ["admin"],
    });

    const product = await catalogService.createProduct(adminCtx, {
      name: "Pending Guard Product",
      slug: "pending-guard-product",
      shortDescription: "Product to test single pending guard",
    });

    // 1st propose succeeds (lines sum to 10,000 bps)
    await ownershipService.proposeOwnership(adminCtx, {
      productId: product.productId,
      companyCutBps: 2000,
      lines: [{ partnerId: partner.id, shareBps: 10000 }],
    });

    // 2nd propose must fail with STATE_INVALID
    await expect(
      ownershipService.proposeOwnership(adminCtx, {
        productId: product.productId,
        companyCutBps: 3000,
        lines: [{ partnerId: partner.id, shareBps: 10000 }],
      }),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: ErrorCode.STATE_INVALID,
      }),
    );
  });
});
