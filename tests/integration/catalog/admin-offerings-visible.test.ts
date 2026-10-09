import { beforeAll, describe, expect, it } from "vitest";
import { anonymousContext, buildContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { offeringsService } from "@/modules/offerings/service";
import { createProduct } from "../../factories/catalog";
import { createAdmin } from "../../factories/users";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

describe("catalog reads return offerings (regression)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  async function setup(status: "draft" | "published") {
    await truncateAll();
    const admin = await createAdmin();
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-offerings-visible" },
      roles: ["admin"],
    });
    const product = await createProduct({ status, createdBy: admin.id });
    const { offering } = await offeringsService.upsertOffering(ctx, {
      productId: product.id,
      name: "Starter Tier",
      slug: "starter-tier",
      position: 0,
      isDefault: true,
      purchaseModel: "one_time",
      deliveryType: "download",
      deliveryConfig: { provisioning: "manual", updatePolicy: "all_free" },
      status: "active",
    });
    return { ctx, product, offering };
  }

  it("getProductAdmin includes the offering", async () => {
    const { ctx, product, offering } = await setup("draft");
    const graph = await catalogService.getProductAdmin(ctx, { productId: product.id });
    expect(graph.offerings.length).toBe(1);
    expect(graph.offerings[0]?.id).toBe(offering.id);
  });

  it("getProductBySlug includes the active offering", async () => {
    const { product, offering } = await setup("published");
    const detail = await catalogService.getProductBySlug(anonymousContext(), {
      slug: product.slug,
      displayCurrency: "INR",
    });
    expect(detail.offerings.length).toBe(1);
    expect(detail.offerings[0]?.id).toBe(offering.id);
  });
});
