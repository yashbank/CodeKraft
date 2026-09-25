import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { productOwnerships, productOwnershipLines } from "../../../drizzle/schema/ownership";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin, createPartner } from "../../factories/users";

describe("ownership DB trigger: sum must equal 10000 bps (BR-06, P3.8)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("fails with DB exception when lines sum != 10000 at commit time", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const partner = await createPartner();

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-sum-trg" },
      roles: ["admin"],
    });

    const product = await catalogService.createProduct(adminCtx, {
      name: "Sum Trigger Product",
      slug: "sum-trigger-product",
      shortDescription: "Product to test DB sum trigger",
    });

    let threw = false;
    try {
      await withTx(async (tx) => {
        const [ownership] = await tx
          .insert(productOwnerships)
          .values({
            productId: product.productId,
            version: 2,
            companyCutBps: 2000,
            status: "active",
            createdBy: admin.id,
          })
          .returning();

        // Insert line with only 8000 bps (total 8000 != 10000)
        await tx.insert(productOwnershipLines).values({
          ownershipId: ownership!.id,
          partnerId: partner.id,
          shareBps: 8000,
        });

        // Trigger immediate constraint check in transaction
        await tx.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`);
      });
    } catch (err: any) {
      threw = true;
      const full = `${err.message} ${err.cause?.message ?? ""} ${JSON.stringify(err)}`;
      expect(full).toMatch(/ownership_lines_sum|SET CONSTRAINTS ALL IMMEDIATE/);
    }

    expect(threw).toBe(true);
  });
});
