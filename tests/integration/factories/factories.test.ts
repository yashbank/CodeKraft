/**
 * P2.9 factories: every factory inserts a valid row (FK integrity) inside a rolled-back
 * transaction; the ownership factory hits the `ownership_lines_sum` trigger; seedExampleCatalog
 * builds the five docs/05 §14 products; users hash with argon2id and carry `user_roles` rows;
 * defaults are deterministic under `resetSequences()`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

// `getDb()` (the factories' default handle) validates env on first use — point it at the test DB.
process.env.APP_ENV = "local";
process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "";
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;

import { closeDb } from "@/lib/db";
import { verifyPassword } from "@/modules/auth/hash";
import { accounts, userRoles, users } from "../../../drizzle/schema/auth";
import { categories, products } from "../../../drizzle/schema/catalog";
import { orderItems, orders, payments } from "../../../drizzle/schema/commerce";
import { entitlements, subscriptions } from "../../../drizzle/schema/delivery";
import {
  offeringPaymentMethods,
  offeringPrices,
  offerings,
} from "../../../drizzle/schema/offerings";
import { productOwnershipLines, productOwnerships } from "../../../drizzle/schema/ownership";
import { partners } from "../../../drizzle/schema/users-ext";
import {
  EXAMPLE_CATALOG,
  FACTORY_PASSWORD,
  type Factories,
  createProduct,
  ownershipLinesTotal,
  resetSequences,
  withFactories,
} from "../../factories";
import { getTestDb, truncateAll, withRollback } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

const sql = getTestDb();

/** Run `fn` with factories bound to a transaction that is always rolled back. */
const inTx = <T>(fn: (f: Factories) => Promise<T>) => withRollback((tx) => fn(withFactories(tx)));

/** Message of a rejected promise including its `cause` chain (drizzle wraps Postgres errors). */
const errorMessage = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return "";
  } catch (err) {
    const parts: string[] = [];
    for (let e: unknown = err; e instanceof Error; e = e.cause) parts.push(e.message);
    return parts.join(" <- ");
  }
};

beforeAll(async () => {
  await migrateTestDb();
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe("identity factories", () => {
  it("createUser inserts a user, an argon2id credential account and no role row for customers", async () => {
    await inTx(async (f) => {
      const user = await f.createUser();
      expect(user.email).toMatch(/@factory\.test$/);
      expect(user.status).toBe("active");
      const [acc] = await f.db.select().from(accounts).where(eq(accounts.userId, user.id));
      expect(acc?.providerId).toBe("credential");
      expect(acc?.accountId).toBe(user.id);
      expect(acc?.password?.startsWith("$argon2id$")).toBe(true);
      expect(await verifyPassword({ hash: acc!.password!, password: FACTORY_PASSWORD })).toBe(true);
      const roles = await f.db.select().from(userRoles).where(eq(userRoles.userId, user.id));
      expect(roles).toHaveLength(0);
    });
  });

  it("createUser({ role: 'super_admin' }) yields a user_roles row; overrides apply", async () => {
    await inTx(async (f) => {
      const admin = await f.createUser({
        role: "super_admin",
        status: "suspended",
        emailVerified: false,
      });
      const roles = await f.db.select().from(userRoles).where(eq(userRoles.userId, admin.id));
      expect(roles.map((r) => r.roleKey)).toEqual(["super_admin"]);
      expect(admin.status).toBe("suspended");
      expect(admin.emailVerified).toBe(false);
      const staff = await f.createAdmin();
      const [row] = await f.db.select().from(userRoles).where(eq(userRoles.userId, staff.id));
      expect(row?.roleKey).toBe("admin");
    });
  });

  it("createPartner links a partner to an (admin) user", async () => {
    await inTx(async (f) => {
      const partner = await f.createPartner();
      const [user] = await f.db.select().from(users).where(eq(users.id, partner.userId));
      expect(user).toBeTruthy();
      expect(partner.active).toBe(true);
      const [dup] = await f.db.select().from(partners).where(eq(partners.userId, partner.userId));
      expect(dup?.id).toBe(partner.id);
    });
  });
});

describe("catalog factories", () => {
  it("createCategory builds two levels and the depth trigger rejects a third", async () => {
    await inTx(async (f) => {
      const root = await f.createCategory({ name: "Root" });
      const child = await f.createCategory({ parentId: root.id });
      expect(child.parentId).toBe(root.id);
      const [stored] = await f.db.select().from(categories).where(eq(categories.id, child.id));
      expect(stored?.parentId).toBe(root.id);
      expect(await errorMessage(f.createCategory({ parentId: child.id }))).toContain(
        "category_depth",
      );
    });
  });

  it("createProduct inserts a published product with an active ownership version when asked", async () => {
    await inTx(async (f) => {
      const a = await f.createPartner();
      const b = await f.createPartner();
      const product = await f.createProduct({
        ownership: {
          companyCutBps: 1000,
          lines: [
            { partnerId: a.id, shareBps: 7000 },
            { partnerId: b.id, shareBps: 3000 },
          ],
        },
      });
      expect(product.status).toBe("published");
      expect(product.publishedAt).toBeInstanceOf(Date);
      expect(product.ownership?.status).toBe("active");
      expect(product.ownership?.companyCutBps).toBe(1000);
      expect(product.ownership?.lines.map((l) => l.shareBps).sort()).toEqual([3000, 7000]);
      const [stored] = await f.db
        .select()
        .from(productOwnerships)
        .where(eq(productOwnerships.productId, product.id));
      expect(stored?.version).toBe(1);
      const plain = await f.createProduct({ status: "draft" });
      expect(plain.ownership).toBeNull();
      expect(plain.publishedAt).toBeNull();
    });
  });

  it("createOwnership fires ownership_lines_sum for 9 999 bps and accepts a single 10 000 line", async () => {
    await inTx(async (f) => {
      const product = await f.createProduct();
      const partner = await f.createPartner();
      const msg = await errorMessage(
        f.createOwnership({
          productId: product.id,
          lines: [{ partnerId: partner.id, shareBps: 9999 }],
        }),
      );
      expect(msg).toContain("ownership_lines_sum");
    });
    await inTx(async (f) => {
      const product = await f.createProduct();
      const partner = await f.createPartner();
      const own = await f.createOwnership({
        productId: product.id,
        lines: [{ partnerId: partner.id, shareBps: 10_000 }],
      });
      const lines = await f.db
        .select()
        .from(productOwnershipLines)
        .where(eq(productOwnershipLines.ownershipId, own.id));
      expect(lines).toHaveLength(1);
      expect(lines[0]?.shareBps).toBe(10_000);
    });
  });

  it("createOffering inserts prices and payment methods", async () => {
    await inTx(async (f) => {
      const offering = await f.createOffering({
        purchaseModel: "subscription",
        deliveryType: "saas",
        price: { amountMinor: 149_900, currency: "INR" },
        methods: ["manual_upi"],
      });
      expect(offering.billingInterval).toBe("monthly");
      const prices = await f.db
        .select()
        .from(offeringPrices)
        .where(eq(offeringPrices.offeringId, offering.id));
      expect(prices).toHaveLength(1);
      expect(prices[0]?.amountMinor).toBe(149_900);
      expect(prices[0]?.currency).toBe("INR");
      const methods = await f.db
        .select()
        .from(offeringPaymentMethods)
        .where(eq(offeringPaymentMethods.offeringId, offering.id));
      expect(methods.map((m) => m.method)).toEqual(["manual_upi"]);
      const [product] = await f.db
        .select()
        .from(products)
        .where(eq(products.id, offering.productId));
      expect(product).toBeTruthy();
    });
  });

  it("createMedia inserts a stored-object row", async () => {
    await inTx(async (f) => {
      const m = await f.createMedia({ visibility: "private" });
      expect(m.bucket).toBe("codekraft-dev-private");
      expect(m.objectKey).toMatch(/^factory\/media-\d{4}\.png$/);
    });
  });
});

describe("commerce factories", () => {
  it("createOrder + createOrderItem compute totals and snapshot the active ownership", async () => {
    await inTx(async (f) => {
      const product = await f.createProduct({ ownership: {} });
      const offering = await f.createOffering({
        productId: product.id,
        price: { amountMinor: 10_000, currency: "INR" },
      });
      const order = await f.createOrder({
        offering,
        quantity: 2,
        taxRateBps: 1800,
        status: "paid",
      });
      expect(order.orderNo).toMatch(/^CK-ORD-\d{6}$/);
      expect(order.subtotalMinor).toBe(20_000);
      expect(order.taxMinor).toBe(3_600);
      expect(order.totalMinor).toBe(23_600);
      expect(order.paidAt).toBeInstanceOf(Date);
      expect(order.items).toHaveLength(1);
      expect(order.items[0]?.ownershipId).toBe(product.ownership?.id);
      expect(order.items[0]?.productId).toBe(product.id);
      const items = await f.db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      expect(items).toHaveLength(1);

      const extra = await f.createOrderItem({ orderId: order.id, quantity: 3 });
      expect(extra.totalMinor).toBe(3 * 99_900);
      expect(extra.ownershipId).toBeNull(); // default offering's product has no ownership
      const [stored] = await f.db.select().from(orders).where(eq(orders.id, order.id));
      expect(stored?.userId).toBe(order.userId);
    });
  });

  it("createPayment defaults to a confirmed manual UPI payment and models shortfall/credit", async () => {
    await inTx(async (f) => {
      const order = await f.createOrder();
      const paid = await f.createPayment({ order });
      expect(paid.status).toBe("confirmed");
      expect(paid.amountReceivedMinor).toBe(order.totalMinor);
      expect(paid.confirmedBy).toBeTruthy();
      expect(paid.bankShortfallMinor).toBe(0);
      const short = await f.createPayment({
        order,
        status: "submitted",
        amountReceivedMinor: order.totalMinor - 500,
      });
      expect(short.bankShortfallMinor).toBe(500);
      expect(short.confirmedAt).toBeNull();
      const rows = await f.db.select().from(payments).where(eq(payments.orderId, order.id));
      expect(rows).toHaveLength(2);
      // the frozen-payment trigger still guards factory rows
      expect(
        await errorMessage(
          f.db.update(payments).set({ amountReceivedMinor: 1 }).where(eq(payments.id, paid.id)),
        ),
      ).toContain("payment_frozen");
    });
  });

  it("createCoupon, createQuote and createInvoice insert valid rows", async () => {
    await inTx(async (f) => {
      const pct = await f.createCoupon();
      expect(pct.kind).toBe("percent");
      expect(pct.value).toBe(1000);
      expect(pct.currency).toBeNull();
      const fixed = await f.createCoupon({ kind: "fixed", code: "FLAT500", maxRedemptions: 1 });
      expect(fixed.currency).toBe("INR");
      expect(fixed.code).toBe("FLAT500");

      const quote = await f.createQuote({ amountMinor: 250_000 });
      expect(quote.status).toBe("sent");
      expect(quote.token).toMatch(/^quote-\d{4}-token$/);

      const order = await f.createOrder({ status: "paid" });
      const invoice = await f.createInvoice({ order });
      expect(invoice.orderId).toBe(order.id);
      expect(invoice.invoiceNo).toMatch(/^CK\/\d{4}-\d{2}\/\d{4}$/);
      expect(invoice.totalMinor).toBe(order.totalMinor);
      expect(invoice.lines).toHaveLength(1);
    });
  });
});

describe("delivery factories", () => {
  it("createEntitlement derives delivery type, product and download cap from the offering", async () => {
    await inTx(async (f) => {
      const offering = await f.createOffering({ deliveryType: "download" });
      const user = await f.createUser();
      const ent = await f.createEntitlement({ user, offering, status: "active" });
      expect(ent.deliveryType).toBe("download");
      expect(ent.productId).toBe(offering.productId);
      expect(ent.downloadCap).toBe(3);
      expect(ent.orderItemId).toBeNull();
      const saas = await f.createEntitlement({ deliveryType: "saas", status: "suspended" });
      expect(saas.provisioningState).toBe("done");
      const rows = await f.db.select().from(entitlements).where(eq(entitlements.userId, user.id));
      expect(rows).toHaveLength(1);
    });
  });

  it("createSubscription creates the subscription offering + entitlement when none is given", async () => {
    await inTx(async (f) => {
      const sub = await f.createSubscription({ interval: "annual", status: "past_due" });
      expect(sub.graceUntil).toBeInstanceOf(Date);
      const [ent] = await f.db
        .select()
        .from(entitlements)
        .where(eq(entitlements.id, sub.entitlementId));
      expect(ent?.deliveryType).toBe("saas");
      const [off] = await f.db.select().from(offerings).where(eq(offerings.id, ent!.offeringId));
      expect(off?.purchaseModel).toBe("subscription");
      expect(off?.billingInterval).toBe("annual");
      const months =
        (sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) / (30 * 86_400_000);
      expect(months).toBeGreaterThan(11);
      const [stored] = await f.db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
      expect(stored?.status).toBe("past_due");
    });
  });
});

describe("leads, queries, chat, approvals", () => {
  it("createLead / createQuery / createConversation insert rows with their FKs", async () => {
    await inTx(async (f) => {
      const product = await f.createProduct();
      const lead = await f.createLead({ productId: product.id, source: "product_cta" });
      expect(lead.productId).toBe(product.id);
      expect(lead.status).toBe("new");

      const query = await f.createQuery({ productId: product.id });
      expect(query.userId).toBeTruthy();
      const guest = await f.createQuery({ guestEmail: "guest@example.test" });
      expect(guest.userId).toBeNull();

      const convo = await f.createConversation();
      expect(convo.purgeAfter).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const escalated = await f.createQuery({ conversationId: convo.id, source: "chatbot" });
      expect(escalated.conversationId).toBe(convo.id);
    });
  });

  it("createApprovalRequest + createApprovalDecision respect approver ≠ requester", async () => {
    await inTx(async (f) => {
      const request = await f.createApprovalRequest();
      expect(request.type).toBe("product.publish");
      expect(request.status).toBe("pending");
      const decision = await f.createApprovalDecision({ request });
      expect(decision.decidedBy).not.toBe(request.requestedBy);
      expect(
        await errorMessage(f.createApprovalDecision({ request, decidedBy: request.requestedBy })),
      ).toContain("approver_is_requester");
    });
  });
});

describe("seedExampleCatalog", () => {
  it("EXAMPLE_CATALOG is pure data whose ownership lines sum to 10 000 for all five products", () => {
    expect(EXAMPLE_CATALOG.products).toHaveLength(5);
    expect(EXAMPLE_CATALOG.products.map((p) => p.slug)).toEqual([
      "fitdesk-pro",
      "tradeflow",
      "mis-portal",
      "resume-portfolio-website",
      "ecommerce-website",
    ]);
    for (const p of EXAMPLE_CATALOG.products) {
      expect(ownershipLinesTotal(p.ownership)).toBe(10_000);
      expect(p.offerings.length).toBeGreaterThan(0);
      for (const o of p.offerings) expect(o.prices[0]?.currency).toBe("INR");
    }
  });

  it("inserts five products, their offerings and active ownership versions per docs/10 §3", async () => {
    await inTx(async (f) => {
      const seeded = await f.seedExampleCatalog();
      expect(seeded.products).toHaveLength(5);
      expect(seeded.users.ceo.email).toBe("ceo@codekraft.test");
      expect(seeded.partners.cfo.userId).toBe(seeded.users.cfo.id);

      const productRows = await f.db.select().from(products);
      expect(productRows).toHaveLength(5);
      expect(productRows.every((p) => p.status === "published")).toBe(true);

      const offeringRows = await f.db.select().from(offerings);
      expect(offeringRows.length).toBeGreaterThanOrEqual(5);
      const priceRows = await f.db.select().from(offeringPrices);
      expect(priceRows.length).toBeGreaterThanOrEqual(offeringRows.length);

      const ownershipRows = await f.db
        .select()
        .from(productOwnerships)
        .where(eq(productOwnerships.status, "active"));
      expect(ownershipRows).toHaveLength(5);
      for (const own of ownershipRows) {
        const lines = await f.db
          .select()
          .from(productOwnershipLines)
          .where(eq(productOwnershipLines.ownershipId, own.id));
        expect(lines.reduce((s, l) => s + l.shareBps, 0)).toBe(10_000);
        expect(own.approvalRequestId).toBeTruthy();
      }

      // FitDesk Pro: 60/40 with a 10 % cut, found by slug
      const [fitdesk] = await f.db.select().from(products).where(eq(products.slug, "fitdesk-pro"));
      const [fdOwn] = await f.db
        .select()
        .from(productOwnerships)
        .where(
          and(eq(productOwnerships.productId, fitdesk!.id), eq(productOwnerships.status, "active")),
        );
      expect(fdOwn?.companyCutBps).toBe(1000);
      const fdLines = await f.db
        .select()
        .from(productOwnershipLines)
        .where(eq(productOwnershipLines.ownershipId, fdOwn!.id));
      const byPartner = new Map(fdLines.map((l) => [l.partnerId, l.shareBps]));
      expect(byPartner.get(seeded.partners.ceo.id)).toBe(6000);
      expect(byPartner.get(seeded.partners.cfo.id)).toBe(4000);
      const fdOfferings = await f.db
        .select()
        .from(offerings)
        .where(eq(offerings.productId, fitdesk!.id));
      expect(fdOfferings.map((o) => o.purchaseModel)).toEqual(["subscription", "subscription"]);

      // TradeFlow: 100 % CFO, one-time license
      const tradeflow = seeded.products.find((p) => p.data.slug === "tradeflow")!;
      expect(tradeflow.ownership.lines).toEqual([
        expect.objectContaining({ partnerId: seeded.partners.cfo.id, shareBps: 10_000 }),
      ]);
      expect(tradeflow.offerings[0]?.deliveryType).toBe("license");
      expect(tradeflow.offerings[0]?.purchaseModel).toBe("one_time");

      // MIS Portal has service steps; the two download products have caps
      const mis = seeded.products.find((p) => p.data.slug === "mis-portal")!;
      expect(mis.offerings[0]?.deliveryType).toBe("hosted");
      expect(mis.offerings[0]?.serviceSteps).toHaveLength(3);
      const ecom = seeded.products.find((p) => p.data.slug === "ecommerce-website")!;
      expect(ecom.offerings.map((o) => o.deliveryType)).toEqual(["download", "service"]);

      // idempotent: a second call returns the same rows and inserts nothing new
      const again = await f.seedExampleCatalog();
      expect(again.products.map((p) => p.product.id)).toEqual(
        seeded.products.map((p) => p.product.id),
      );
      expect(await f.db.select().from(products)).toHaveLength(5);
      expect(await f.db.select().from(productOwnerships)).toHaveLength(5);
    });
  });

  it("works on the pooled app client (default `db`) and commits", async () => {
    const product = await createProduct({ slug: "pooled-client-product", ownership: {} });
    const [row] = await sql<{ slug: string }[]>`
      select slug from products where id = ${product.id}
    `;
    expect(row?.slug).toBe("pooled-client-product");
    const [own] = await sql<{ n: string }[]>`
      select count(*)::text as n from product_ownership_lines where ownership_id = ${product.ownership!.id}
    `;
    expect(Number(own?.n)).toBe(1);
  });
});

describe("determinism", () => {
  it("resetSequences() replays the same defaults", async () => {
    const run = () =>
      inTx(async (f) => {
        resetSequences();
        const user = await f.createUser();
        const product = await f.createProduct();
        const coupon = await f.createCoupon();
        return { email: user.email, slug: product.slug, code: coupon.code };
      });
    const first = await run();
    const second = await run();
    expect(second).toEqual(first);
    expect(first.email).toBe("user-0001@factory.test");
  });
});
