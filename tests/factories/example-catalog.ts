/**
 * The five docs/05 §14 example products as plain data (`EXAMPLE_CATALOG`, no DB — reusable by
 * scripts/seed.ts, P2.10) plus `seedExampleCatalog()` which inserts them through the factories:
 * category, product, offerings (prices + methods), an `active` ownership version approved by the
 * other admin (`ownership.change` request + decision), owned by the CEO/CFO partners.
 *
 * Splits follow docs/10 §3 / PHASE-02 P2.10: FitDesk Pro 60/40 with a 10 % company cut, TradeFlow
 * 100 % CFO, the other three 50/50 with 0 % cut. Tests find these rows by slug, never by id.
 */
import { and, eq } from "drizzle-orm";

import type { Currency } from "@/lib/money";
import type { User } from "../../drizzle/schema/auth";
import { type Category, categories } from "../../drizzle/schema/catalog";
import type {
  DeliveryConfig,
  DeliveryTypeValue,
  PaymentMethodValue,
  ServiceStep,
} from "../../drizzle/schema/offerings";
import { offerings as offeringsTable } from "../../drizzle/schema/offerings";
import type { Partner } from "../../drizzle/schema/users-ext";
import { createApprovalDecision, createApprovalRequest } from "./approvals";
import {
  type ProductWithOwnership,
  createCategory,
  createProduct,
  findProductBySlug,
} from "./catalog";
import { type FactoryDb, toFactoryDb } from "./context";
import {
  type BillingInterval,
  type OfferingWithPrices,
  type PurchaseModel,
  createOffering,
  findOffering,
} from "./offerings";
import { type OwnershipWithLines, createOwnership, findActiveOwnership } from "./ownership";
import { createPartner, createSuperAdmin, findPartnerByUserId, findUserByEmail } from "./users";

// ---------------------------------------------------------------------------------------------
// Pure data
// ---------------------------------------------------------------------------------------------

export type ExamplePartnerKey = "ceo" | "cfo";

export interface ExamplePartner {
  email: string;
  name: string;
  displayName: string;
}

export interface ExampleOffering {
  slug: string;
  name: string;
  purchaseModel: PurchaseModel;
  billingInterval?: BillingInterval;
  deliveryType: DeliveryTypeValue;
  licenseType?: string;
  isDefault?: boolean;
  prices: { currency: Currency; amountMinor: number; compareAtMinor?: number }[];
  methods: PaymentMethodValue[];
  deliveryConfig: DeliveryConfig;
  serviceSteps?: ServiceStep[];
}

export interface ExampleOwnership {
  companyCutBps: number;
  lines: { partner: ExamplePartnerKey; shareBps: number }[];
}

export interface ExampleProduct {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  category: string;
  techStack: string[];
  industry: string[];
  features: { title: string; description?: string }[];
  isFeatured: boolean;
  isRefundable: boolean;
  ownership: ExampleOwnership;
  offerings: ExampleOffering[];
}

export interface ExampleCatalog {
  partners: Record<ExamplePartnerKey, ExamplePartner>;
  categories: { slug: string; name: string; parent?: string }[];
  products: ExampleProduct[];
}

const MANUAL: PaymentMethodValue[] = ["manual_upi", "manual_bank"];

/** docs/05 §14 — data only (D-018); never imported by `src/**`. */
export const EXAMPLE_CATALOG: ExampleCatalog = {
  partners: {
    ceo: { email: "ceo@codekraft.test", name: "CEO", displayName: "CodeKraft CEO" },
    cfo: { email: "cfo@codekraft.test", name: "CFO", displayName: "CodeKraft CFO" },
  },
  categories: [
    { slug: "saas", name: "SaaS products" },
    { slug: "business-software", name: "Business software" },
    { slug: "websites", name: "Websites" },
    { slug: "portfolio-sites", name: "Portfolio sites", parent: "websites" },
  ],
  products: [
    {
      slug: "fitdesk-pro",
      name: "FitDesk Pro",
      shortDescription: "Gym and studio management SaaS with memberships, classes and billing.",
      description:
        "FitDesk Pro runs your fitness business: member CRM, class scheduling, attendance and automated billing.",
      category: "saas",
      techStack: ["Next.js", "Postgres", "Tailwind"],
      industry: ["Fitness", "Wellness"],
      features: [
        { title: "Member CRM" },
        { title: "Class scheduling" },
        { title: "Automated billing" },
      ],
      isFeatured: true,
      isRefundable: false,
      ownership: {
        companyCutBps: 1000,
        lines: [
          { partner: "ceo", shareBps: 6000 },
          { partner: "cfo", shareBps: 4000 },
        ],
      },
      offerings: [
        {
          slug: "monthly",
          name: "FitDesk Pro — Monthly",
          purchaseModel: "subscription",
          billingInterval: "monthly",
          deliveryType: "saas",
          isDefault: true,
          prices: [
            { currency: "INR", amountMinor: 149_900 },
            { currency: "USD", amountMinor: 1_900 },
          ],
          methods: MANUAL,
          deliveryConfig: {
            provisioning: "manual",
            appUrl: "https://app.fitdesk.test",
            updatePolicy: "during_access",
          },
        },
        {
          slug: "annual",
          name: "FitDesk Pro — Annual",
          purchaseModel: "subscription",
          billingInterval: "annual",
          deliveryType: "saas",
          prices: [{ currency: "INR", amountMinor: 1_499_900, compareAtMinor: 1_798_800 }],
          methods: MANUAL,
          deliveryConfig: {
            provisioning: "manual",
            appUrl: "https://app.fitdesk.test",
            updatePolicy: "during_access",
          },
        },
      ],
    },
    {
      slug: "tradeflow",
      name: "TradeFlow",
      shortDescription: "Inventory and invoicing desktop suite for traders — one-time license.",
      description:
        "TradeFlow covers purchase, stock, sales and GST invoicing for small trading businesses.",
      category: "business-software",
      techStack: ["Electron", "SQLite"],
      industry: ["Retail", "Wholesale"],
      features: [{ title: "GST invoicing" }, { title: "Stock ledger" }, { title: "Offline first" }],
      isFeatured: true,
      isRefundable: false,
      ownership: { companyCutBps: 0, lines: [{ partner: "cfo", shareBps: 10_000 }] },
      offerings: [
        {
          slug: "license",
          name: "TradeFlow — Perpetual license",
          purchaseModel: "one_time",
          deliveryType: "license",
          licenseType: "perpetual",
          isDefault: true,
          prices: [{ currency: "INR", amountMinor: 4_999_900 }],
          methods: MANUAL,
          deliveryConfig: {
            provisioning: "manual",
            accessMonths: null,
            updatePolicy: "major_paid",
          },
        },
      ],
    },
    {
      slug: "mis-portal",
      name: "MIS Portal",
      shortDescription: "Hosted management-information portal with onboarding service.",
      description:
        "A hosted reporting portal: dashboards over your ERP exports, delivered with a three-step onboarding.",
      category: "business-software",
      techStack: ["Next.js", "Postgres", "Metabase"],
      industry: ["Manufacturing", "Services"],
      features: [
        { title: "KPI dashboards" },
        { title: "Scheduled reports" },
        { title: "Role-based access" },
      ],
      isFeatured: false,
      isRefundable: false,
      ownership: {
        companyCutBps: 0,
        lines: [
          { partner: "ceo", shareBps: 5000 },
          { partner: "cfo", shareBps: 5000 },
        ],
      },
      offerings: [
        {
          slug: "hosted",
          name: "MIS Portal — Hosted + onboarding",
          purchaseModel: "one_time",
          deliveryType: "hosted",
          isDefault: true,
          prices: [{ currency: "INR", amountMinor: 14_999_900 }],
          methods: MANUAL,
          deliveryConfig: {
            provisioning: "manual",
            customerHosted: false,
            updatePolicy: "during_access",
            accessMonths: 12,
          },
          serviceSteps: [
            { key: "kickoff", title: "Kick-off call" },
            { key: "data-import", title: "Data import" },
            { key: "go-live", title: "Go-live" },
          ],
        },
      ],
    },
    {
      slug: "resume-portfolio-website",
      name: "Resume/Portfolio Website",
      shortDescription: "Downloadable personal portfolio template — deploy anywhere.",
      description:
        "A polished résumé and portfolio site template with dark and light themes, ready to deploy.",
      category: "portfolio-sites",
      techStack: ["Astro", "Tailwind"],
      industry: ["Freelance", "Personal"],
      features: [{ title: "Two themes" }, { title: "SEO ready" }, { title: "Markdown content" }],
      isFeatured: false,
      isRefundable: true,
      ownership: {
        companyCutBps: 0,
        lines: [
          { partner: "ceo", shareBps: 5000 },
          { partner: "cfo", shareBps: 5000 },
        ],
      },
      offerings: [
        {
          slug: "download",
          name: "Resume/Portfolio Website — Download",
          purchaseModel: "one_time",
          deliveryType: "download",
          isDefault: true,
          prices: [{ currency: "INR", amountMinor: 299_900 }],
          methods: MANUAL,
          deliveryConfig: { downloadCap: 3, accessMonths: null, updatePolicy: "all_free" },
        },
      ],
    },
    {
      slug: "ecommerce-website",
      name: "E-commerce Website",
      shortDescription: "Storefront source download with an optional setup service.",
      description:
        "A complete storefront (catalog, cart, checkout) as a source download, plus a setup service.",
      category: "websites",
      techStack: ["Next.js", "Postgres", "Stripe"],
      industry: ["Retail", "D2C"],
      features: [
        { title: "Cart and checkout" },
        { title: "Admin panel" },
        { title: "Setup service" },
      ],
      isFeatured: true,
      isRefundable: false,
      ownership: {
        companyCutBps: 0,
        lines: [
          { partner: "ceo", shareBps: 5000 },
          { partner: "cfo", shareBps: 5000 },
        ],
      },
      offerings: [
        {
          slug: "download",
          name: "E-commerce Website — Download",
          purchaseModel: "one_time",
          deliveryType: "download",
          isDefault: true,
          prices: [{ currency: "INR", amountMinor: 2_499_900 }],
          methods: MANUAL,
          deliveryConfig: { downloadCap: 5, accessMonths: null, updatePolicy: "during_access" },
        },
        {
          slug: "setup-service",
          name: "E-commerce Website — Setup service",
          purchaseModel: "one_time",
          deliveryType: "service",
          prices: [{ currency: "INR", amountMinor: 999_900 }],
          methods: MANUAL,
          deliveryConfig: { provisioning: "manual" },
          serviceSteps: [
            { key: "requirements", title: "Requirements call" },
            { key: "deploy", title: "Deploy to your host" },
            { key: "handover", title: "Handover" },
          ],
        },
      ],
    },
  ],
};

/** Sum of a product's ownership lines (should be 10 000 for every example product). */
export function ownershipLinesTotal(ownership: ExampleOwnership): number {
  return ownership.lines.reduce((sum, l) => sum + l.shareBps, 0);
}

// ---------------------------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------------------------

export interface SeedExampleCatalogOptions {
  /** Existing partners keyed like `EXAMPLE_CATALOG.partners`; default: found by email or created. */
  partners?: Record<ExamplePartnerKey, Partner>;
  /** Product status; default `published` (P2.10 uses `draft` in production). */
  status?: ProductWithOwnership["status"];
}

export interface SeededExampleProduct {
  data: ExampleProduct;
  product: ProductWithOwnership;
  offerings: OfferingWithPrices[];
  ownership: OwnershipWithLines;
}

export interface SeededExampleCatalog {
  users: Record<ExamplePartnerKey, User>;
  partners: Record<ExamplePartnerKey, Partner>;
  categories: Record<string, Category>;
  products: SeededExampleProduct[];
}

async function ensurePartnerUser(
  key: ExamplePartnerKey,
  db: FactoryDb,
): Promise<{ user: User; partner: Partner }> {
  const spec = EXAMPLE_CATALOG.partners[key];
  const user =
    (await findUserByEmail(spec.email, db)) ??
    (await createSuperAdmin({ email: spec.email, name: spec.name, emailVerified: true }, db));
  const partner =
    (await findPartnerByUserId(user.id, db)) ??
    (await createPartner({ user, displayName: spec.displayName }, db));
  return { user, partner };
}

async function ensureCategory(
  spec: ExampleCatalog["categories"][number],
  parentId: string | null,
  db: FactoryDb,
): Promise<Category> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, spec.slug))
    .limit(1);
  return existing ?? (await createCategory({ name: spec.name, slug: spec.slug, parentId }, db));
}

/**
 * Insert the five example products (idempotent per slug: an existing product is returned with its
 * offerings and active ownership, nothing is re-inserted). Ownership lines are checked by the DB
 * trigger (Σ = 10 000) on the way in.
 */
export async function seedExampleCatalog(
  opts: SeedExampleCatalogOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<SeededExampleCatalog> {
  const ceo = await ensurePartnerUser("ceo", db);
  const cfo = await ensurePartnerUser("cfo", db);
  const users = { ceo: ceo.user, cfo: cfo.user };
  const partners = opts.partners ?? { ceo: ceo.partner, cfo: cfo.partner };

  const cats: Record<string, Category> = {};
  for (const spec of EXAMPLE_CATALOG.categories) {
    const parentId = spec.parent === undefined ? null : (cats[spec.parent]?.id ?? null);
    cats[spec.slug] = await ensureCategory(spec, parentId, db);
  }

  const products: SeededExampleProduct[] = [];
  for (const data of EXAMPLE_CATALOG.products) {
    const existing = await findProductBySlug(data.slug, db);
    if (existing !== null) {
      const ownership = await findActiveOwnership(existing.id, db);
      if (ownership === null)
        throw new Error(`example product ${data.slug} exists without an active ownership`);
      const rows = await db
        .select({ id: offeringsTable.id })
        .from(offeringsTable)
        .where(and(eq(offeringsTable.productId, existing.id), eq(offeringsTable.status, "active")));
      const found: OfferingWithPrices[] = [];
      for (const r of rows) {
        const o = await findOffering(r.id, db);
        if (o !== null) found.push(o);
      }
      products.push({ data, product: { ...existing, ownership }, offerings: found, ownership });
      continue;
    }

    const product = await createProduct(
      {
        name: data.name,
        slug: data.slug,
        shortDescription: data.shortDescription,
        description: data.description,
        status: opts.status ?? "published",
        categoryId: cats[data.category]?.id ?? null,
        isFeatured: data.isFeatured,
        isRefundable: data.isRefundable,
        techStack: data.techStack,
        industry: data.industry,
        features: data.features,
        createdBy: users.ceo.id,
      },
      db,
    );

    const created: OfferingWithPrices[] = [];
    let position = 0;
    for (const o of data.offerings) {
      created.push(
        await createOffering(
          {
            productId: product.id,
            name: o.name,
            slug: o.slug,
            position: position++,
            isDefault: o.isDefault ?? false,
            purchaseModel: o.purchaseModel,
            billingInterval: o.billingInterval ?? null,
            deliveryType: o.deliveryType,
            licenseType: o.licenseType ?? null,
            deliveryConfig: o.deliveryConfig,
            serviceSteps: o.serviceSteps ?? null,
            prices: o.prices,
            methods: o.methods,
          },
          db,
        ),
      );
    }

    // Dual approval of the ownership version: requested by the CEO, approved by the CFO.
    const request = await createApprovalRequest(
      {
        type: "ownership.change",
        subjectType: "product",
        subjectId: product.id,
        payload: { companyCutBps: data.ownership.companyCutBps, lines: data.ownership.lines },
        requestedBy: users.ceo.id,
        status: "applied",
      },
      db,
    );
    await createApprovalDecision({ request, decidedBy: users.cfo.id, decision: "approve" }, db);
    const ownership = await createOwnership(
      {
        productId: product.id,
        companyCutBps: data.ownership.companyCutBps,
        lines: data.ownership.lines.map((l) => ({
          partnerId: partners[l.partner].id,
          shareBps: l.shareBps,
        })),
        status: "active",
        version: 1,
        approvalRequestId: request.id,
        createdBy: users.ceo.id,
      },
      db,
    );
    products.push({ data, product: { ...product, ownership }, offerings: created, ownership });
  }

  return { users, partners, categories: cats, products };
}
