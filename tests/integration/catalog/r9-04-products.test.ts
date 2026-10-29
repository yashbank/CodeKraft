import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext, anonymousContext } from "@/lib/authz/context";
import { computeApproverSet } from "@/modules/approvals/approver-set";
import { approvalsService } from "@/modules/approvals/service";
import { catalogService } from "@/modules/catalog/service";
import { searchService } from "@/modules/search/service";
import { ordersService } from "@/modules/orders/service";
import { scheduledPublishJob } from "@/jobs/publish";
import { db } from "@/lib/db";
import { products, productMedia } from "../../../drizzle/schema/catalog";
import { siteSettings } from "../../../drizzle/schema/settings";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createOwnership } from "../../factories/ownership";
import { createOffering } from "../../factories/offerings";
import { createMedia, createProduct } from "../../factories/catalog";

const visitor = anonymousContext();
const ctxFor = (id: string) =>
  buildContext({ user: { id }, session: { id: `s-${id}` }, roles: ["admin"] });

/** A published product with everything publish needs (active ownership, offering, media). */
async function readyProduct(adminId: string, overrides: Record<string, unknown> = {}) {
  const p = await createProduct({ createdBy: adminId, overrides });
  const partner = await createPartner();
  await createOwnership({
    productId: p.id,
    createdBy: adminId,
    status: "active",
    lines: [{ partnerId: partner.id, shareBps: 10000 }],
  });
  const off = await createOffering({
    productId: p.id,
    status: "active",
    price: { amountMinor: 10000, currency: "INR" },
    methods: ["manual_upi"],
  });
  const m = await createMedia({ uploadedBy: adminId });
  await db.insert(productMedia).values({ productId: p.id, kind: "image", mediaId: m.id, alt: "x" });
  return { ...p, offeringId: off.id };
}

/** Every required approver approves (approver set = all other admin-class users). */
async function approveAll(requesterId: string, approvalRequestId: string) {
  let res;
  for (const id of await computeApproverSet(requesterId, db)) {
    res = await approvalsService.approveRequest(ctxFor(id), { approvalRequestId, comment: "ok" });
  }
  return res!;
}

const statusOf = async (id: string) =>
  (await db.select().from(products).where(eq(products.id, id)))[0];

const list = async () =>
  (
    await searchService.listProducts(visitor, {
      sort: "featured",
      limit: 20,
      displayCurrency: "INR",
    })
  ).items;

describe("R9-04 products: republish, schedule, delete, flags", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("republishes an already-published product after an edit (stays live, approve applies)", async () => {
    await truncateAll();
    const a = await createAdmin();
    await createAdmin();
    const p = await readyProduct(a.id);
    await catalogService.updateProduct(ctxFor(a.id), {
      productId: p.id,
      expectedUpdatedAt: (await statusOf(p.id))!.updatedAt.toISOString(),
      patch: { name: "Edited name" },
    });
    const { approvalRequestId } = await catalogService.submitForApproval(ctxFor(a.id), {
      productId: p.id,
    });
    expect((await statusOf(p.id))?.status).toBe("published");
    await approveAll(a.id, approvalRequestId);
    const row = await statusOf(p.id);
    expect(row?.status).toBe("published");
    expect(row?.name).toBe("Edited name");
  });

  it("rejecting a republish leaves the published product published", async () => {
    await truncateAll();
    const a = await createAdmin();
    const b = await createAdmin();
    const p = await readyProduct(a.id);
    const { approvalRequestId } = await catalogService.submitForApproval(ctxFor(a.id), {
      productId: p.id,
    });
    await approvalsService.rejectRequest(ctxFor(b.id), { approvalRequestId, comment: "no" });
    expect((await statusOf(p.id))?.status).toBe("published");
  });

  it("schedules a published product and the cron publishes it when due", async () => {
    await truncateAll();
    const a = await createAdmin();
    await createAdmin();
    const p = await readyProduct(a.id);
    const at = new Date(Date.now() + 3_600_000);
    const { approvalRequestId } = await catalogService.submitForApproval(ctxFor(a.id), {
      productId: p.id,
      publishAt: at.toISOString(),
    });
    await approveAll(a.id, approvalRequestId);
    expect((await statusOf(p.id))?.status).toBe("scheduled");
    await scheduledPublishJob.run(new Date(at.getTime() + 1000));
    expect((await statusOf(p.id))?.status).toBe("published");
  });

  it("approved delete removes a published product (with ownership/media/offering) everywhere", async () => {
    await truncateAll();
    const a = await createAdmin();
    await createAdmin();
    const p = await readyProduct(a.id, { name: "Doomed Widget" });
    expect((await list()).map((x) => x.slug)).toContain(p.slug);
    const { approvalRequestId } = await catalogService.requestDelete(ctxFor(a.id), {
      productId: p.id,
      reason: "gone",
    });
    const res = await approveAll(a.id, approvalRequestId);
    expect(res.status).toBe("applied");
    expect(await statusOf(p.id)).toBeUndefined();
    expect((await list()).map((x) => x.slug)).not.toContain(p.slug);
    expect((await searchService.listPublishedSlugs()).map((x) => x.slug)).not.toContain(p.slug);
    const adminList = await catalogService.listProductsAdmin(
      buildContext({ user: { id: a.id }, session: { id: "s" }, roles: ["super_admin"] }),
      { limit: 50 },
    );
    expect(adminList.items.map((x) => x.id)).not.toContain(p.id);
  });

  it("coming-soon: carries the badge flag and cannot be bought", async () => {
    await truncateAll();
    const a = await createAdmin();
    const c = await createUser({ emailVerified: true });
    const p = await readyProduct(a.id, { isComingSoon: true });
    expect((await list()).find((x) => x.slug === p.slug)?.isComingSoon).toBe(true);
    await expect(
      ordersService.previewCheckout(
        buildContext({ user: { id: c.id }, session: { id: "c" }, roles: ["user"] }),
        { offeringId: p.offeringId },
      ),
    ).rejects.toThrow();
  });

  it("unlisted: hidden from list/search/sitemap but reachable by slug", async () => {
    await truncateAll();
    const a = await createAdmin();
    const p = await readyProduct(a.id, { name: "Hidden Gem", isUnlisted: true });
    expect((await list()).map((x) => x.slug)).not.toContain(p.slug);
    const found = await searchService.listProducts(visitor, {
      q: "Hidden",
      sort: "featured",
      limit: 20,
      displayCurrency: "INR",
    });
    expect(found.items).toHaveLength(0);
    expect((await searchService.listPublishedSlugs()).map((x) => x.slug)).not.toContain(p.slug);
    const detail = await catalogService.getProductBySlug(visitor, {
      slug: p.slug,
      displayCurrency: "INR",
    });
    expect(detail.isUnlisted).toBe(true);
    const shop = await catalogService.listProducts(visitor, { limit: 20, displayCurrency: "INR" });
    expect(shop.map((x) => x.slug)).not.toContain(p.slug);
  });

  it("featured: appears in the home featured section and sorts first in lists", async () => {
    await truncateAll();
    const a = await createAdmin();
    const other = await readyProduct(a.id, { name: "Plain" });
    await new Promise((r) => setTimeout(r, 20));
    // older publish date than "Plain" would sort it last by recency
    const star = await readyProduct(a.id, {
      name: "Starred",
      isFeatured: true,
      publishedAt: new Date(Date.now() - 86_400_000),
    });
    const home = await catalogService.listFeaturedProducts(visitor, {
      limit: 20,
      displayCurrency: "INR",
    });
    expect(home.map((x) => x.slug)).toEqual([star.slug]);
    const shop = await catalogService.listProducts(visitor, { limit: 20, displayCurrency: "INR" });
    expect(shop[0]?.slug).toBe(star.slug);
    const sorted = await list();
    expect(sorted[0]?.slug).toBe(star.slug);
    expect(sorted.map((x) => x.slug)).toContain(other.slug);
  });

  it("tax-enabled: tax applied only when the product flag is on (GSTIN set)", async () => {
    await truncateAll();
    const a = await createAdmin();
    const c = await createUser({ emailVerified: true });
    await db.insert(siteSettings).values([
      { key: "gstin", value: "29ABCDE1234F1Z5" },
      { key: "tax_rate_bps", value: 1800 },
    ] as never);
    const on = await readyProduct(a.id, { taxEnabled: true });
    const off = await readyProduct(a.id, { taxEnabled: false });
    const cctx = buildContext({ user: { id: c.id }, session: { id: "c" }, roles: ["user"] });
    const pOn = await ordersService.previewCheckout(cctx, { offeringId: on.offeringId });
    const pOff = await ordersService.previewCheckout(cctx, { offeringId: off.offeringId });
    expect(pOn.tax.amountMinor).toBeGreaterThan(0);
    expect(pOff.tax.amountMinor).toBe(0);
  });
});
