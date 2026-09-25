/**
 * P2.10 full seed (docs/05 §14, docs/12 §1): `runSeed()` against the integration database —
 * counts per table, a second run inserts nothing, `--production` writes only the docs/12 §1 subset
 * and refuses without a password; `runAnonymise()` replaces customer PII while keeping row counts
 * and foreign keys intact.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, isNull, like } from "drizzle-orm";

// Better Auth and the factories write through `getDb()` — point it at the integration database.
process.env.APP_ENV = "local";
process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_ADMIN_URL = "http://admin.localhost:3000";
process.env.ADMIN_HOST = "admin.localhost:3000";
process.env.EMAIL_TRANSPORT = "log";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "";
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;

import { closeDb, getDb } from "@/lib/db";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "@/lib/authz/permissions";
import { SEEDED_AT_KEY, SITE_SETTING_KEYS } from "@/modules/settings/types";
import { userRoles, users } from "../../../drizzle/schema/auth";
import {
  categories,
  featuredProducts,
  productBlogs,
  productFaqs,
  productTestimonials,
  productVersions,
  products,
} from "../../../drizzle/schema/catalog";
import { chatMessages, promptVersions } from "../../../drizzle/schema/chat";
import { coupons } from "../../../drizzle/schema/commerce";
import {
  caseStudies,
  clientLogos,
  faqs,
  landingChapters,
  legalPageVersions,
  legalPages,
  services,
  testimonials,
} from "../../../drizzle/schema/content";
import { leads } from "../../../drizzle/schema/leads";
import { media } from "../../../drizzle/schema/media";
import { offerings } from "../../../drizzle/schema/offerings";
import { productOwnershipLines, productOwnerships } from "../../../drizzle/schema/ownership";
import { queries } from "../../../drizzle/schema/queries";
import { fxRates, siteSettings } from "../../../drizzle/schema/settings";
import { partners, permissions, rolePermissions } from "../../../drizzle/schema/users-ext";
import { runAnonymise, runSeed } from "../../../scripts/seed";
import { LAUNCHED_AT_KEY } from "../../../scripts/seed/settings";
import { PLACEHOLDER, countRows } from "../../../scripts/seed/shared";
import { TEST_USER_EMAILS } from "../../../scripts/seed/identity";
import { createConversation, createLead, createQuery, createUser } from "../../factories";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

const ADMIN_EMAILS = ["ceo@codekraft.test", "cfo@codekraft.test"] as const;
const PASSWORD = "seed-test-passphrase-2026";
const SLOW = 180_000;

const db = getDb();

const COUNTED = {
  permissions,
  role_permissions: rolePermissions,
  users,
  user_roles: userRoles,
  partners,
  categories,
  products,
  offerings,
  product_ownerships: productOwnerships,
  product_versions: productVersions,
  product_faqs: productFaqs,
  product_testimonials: productTestimonials,
  product_blogs: productBlogs,
  featured_products: featuredProducts,
  coupons,
  landing_chapters: landingChapters,
  services,
  case_studies: caseStudies,
  testimonials,
  client_logos: clientLogos,
  media,
  faqs,
  legal_pages: legalPages,
  legal_page_versions: legalPageVersions,
  site_settings: siteSettings,
  prompt_versions: promptVersions,
  fx_rates: fxRates,
} as const;

async function snapshot(): Promise<Record<keyof typeof COUNTED, number>> {
  const out = {} as Record<keyof typeof COUNTED, number>;
  for (const [name, table] of Object.entries(COUNTED))
    out[name as keyof typeof COUNTED] = await countRows(db, table);
  return out;
}

const fullSeed = () =>
  runSeed({ db, mode: "full", adminEmails: ADMIN_EMAILS, adminPassword: PASSWORD });

beforeAll(async () => {
  await migrateTestDb();
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe("runSeed({ mode: 'full' })", () => {
  it(
    "seeds the docs/05 §14 dataset with the expected counts",
    async () => {
      const summary = await fullSeed();
      expect(summary.mode).toBe("full");
      expect(summary.created).toBeGreaterThan(0);

      const counts = await snapshot();
      expect(counts.permissions).toBe(51);
      expect(PERMISSIONS).toHaveLength(51);
      const matrixPairs = ROLES.reduce((n, r) => n + ROLE_PERMISSIONS[r].length, 0);
      expect(counts.role_permissions).toBe(matrixPairs);
      for (const role of ROLES) {
        const rows = await db
          .select({ permissionKey: rolePermissions.permissionKey })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleKey, role));
        expect(new Set(rows.map((r) => r.permissionKey))).toEqual(new Set(ROLE_PERMISSIONS[role]));
      }

      // two Super Admins, each with a partners row (CEO, CFO), plus the docs/10 §3 test users
      const superAdmins = await db
        .select({ email: users.email, name: users.name, verified: users.emailVerified })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .where(eq(userRoles.roleKey, "super_admin"));
      expect(superAdmins.map((u) => u.email).sort()).toEqual([...ADMIN_EMAILS].sort());
      expect(superAdmins.every((u) => u.verified)).toBe(true);
      const adminPartners = await db
        .select({ displayName: partners.displayName, email: users.email })
        .from(partners)
        .innerJoin(users, eq(users.id, partners.userId))
        .where(inArray(users.email, [...ADMIN_EMAILS]));
      expect(adminPartners.map((p) => p.displayName).sort()).toEqual(["CEO", "CFO"]);
      expect(counts.users).toBe(6);
      expect(counts.partners).toBe(3);
      const [partnerUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, TEST_USER_EMAILS.partner));
      const partnerRoles = await db
        .select({ roleKey: userRoles.roleKey })
        .from(userRoles)
        .where(eq(userRoles.userId, partnerUser!.id));
      expect(partnerRoles.map((r) => r.roleKey)).toEqual(["admin"]);
      const [suspended] = await db
        .select({ status: users.status })
        .from(users)
        .where(eq(users.email, TEST_USER_EMAILS.suspended));
      expect(suspended?.status).toBe("suspended");

      // catalog
      expect(counts.categories).toBe(4);
      expect(counts.products).toBe(5);
      expect(counts.offerings).toBeGreaterThanOrEqual(7);
      expect(counts.product_ownerships).toBe(5);
      const productRows = await db.select().from(products);
      expect(productRows.every((p) => p.status === "published")).toBe(true);
      const [fitdesk] = productRows.filter((p) => p.slug === "fitdesk-pro");
      const [own] = await db
        .select()
        .from(productOwnerships)
        .where(
          and(eq(productOwnerships.productId, fitdesk!.id), eq(productOwnerships.status, "active")),
        );
      expect(own?.companyCutBps).toBe(1000);
      const lines = await db
        .select({ shareBps: productOwnershipLines.shareBps })
        .from(productOwnershipLines)
        .where(eq(productOwnershipLines.ownershipId, own!.id));
      expect(lines.map((l) => l.shareBps).sort((a, b) => a - b)).toEqual([4000, 6000]);
      expect(counts.product_versions).toBe(5);
      expect(counts.product_faqs).toBe(10);
      expect(counts.product_testimonials).toBe(5);
      expect(counts.product_blogs).toBe(1);
      expect(counts.featured_products).toBe(3);
      expect(counts.coupons).toBe(3);
      const couponCodes = await db.select({ code: coupons.code }).from(coupons);
      expect(couponCodes.map((c) => c.code).sort()).toEqual(["EXPIRED", "FLAT500", "WELCOME10"]);

      // content — placeholders are findable by prefix
      expect(counts.landing_chapters).toBe(5);
      expect(counts.services).toBe(8);
      expect(counts.case_studies).toBe(3);
      expect(counts.testimonials).toBe(3);
      expect(counts.client_logos).toBe(6);
      expect(counts.media).toBe(6);
      expect(counts.faqs).toBe(10);
      expect(counts.legal_pages).toBe(4);
      expect(counts.legal_page_versions).toBe(4);
      const chapterKeys = await db.select({ key: landingChapters.key }).from(landingChapters);
      expect(chapterKeys.map((c) => c.key).sort()).toEqual([
        "build",
        "proof",
        "sell",
        "talk",
        "who",
      ]);
      const legalTitles = await db.select({ title: legalPages.title }).from(legalPages);
      expect(legalTitles.every((l) => l.title.startsWith(PLACEHOLDER))).toBe(true);
      const placeholderServices = await db
        .select({ id: services.id })
        .from(services)
        .where(like(services.title, `${PLACEHOLDER}%`));
      expect(placeholderServices).toHaveLength(8);
      const chatbotFaqs = await db
        .select({ id: faqs.id })
        .from(faqs)
        .where(and(eq(faqs.scope, "chatbot"), isNull(faqs.productId)));
      expect(chatbotFaqs).toHaveLength(4);

      // settings: every typed key + seeded_at + launched_at (null)
      const settingRows = await db.select().from(siteSettings);
      const byKey = new Map(settingRows.map((r) => [r.key, r.value]));
      for (const key of Object.values(SITE_SETTING_KEYS)) expect(byKey.has(key)).toBe(true);
      expect(byKey.get("base_currency")).toBe("INR");
      expect(byKey.get("enabled_currencies")).toEqual(["INR", "USD", "EUR", "GBP", "CAD"]);
      expect(byKey.get("tax_rate_bps")).toBe(0);
      expect(byKey.get("gstin")).toBeNull();
      expect(byKey.get("default_theme")).toBe("dark-cinematic");
      expect(byKey.get("upi_vpa")).toBe("codekraft@upi");
      expect(byKey.get("feature_flags")).toMatchObject({
        three_hero: true,
        provider_stripe: false,
      });
      expect(typeof byKey.get(SEEDED_AT_KEY)).toBe("string");
      expect(byKey.get(LAUNCHED_AT_KEY)).toBeNull();

      // prompt + fx
      const active = await db
        .select()
        .from(promptVersions)
        .where(eq(promptVersions.isActive, true));
      expect(active).toHaveLength(1);
      expect(active[0]?.version).toBe(1);
      expect(counts.fx_rates).toBe(8);
      const usdInr = await db
        .select()
        .from(fxRates)
        .where(and(eq(fxRates.base, "USD"), eq(fxRates.quote, "INR")));
      expect(usdInr[0]?.rate).toBe("83.50000000");
    },
    SLOW,
  );

  it(
    "is idempotent: a second run inserts nothing and every count is unchanged",
    async () => {
      const before = await snapshot();
      const [seededAtBefore] = await db
        .select({ value: siteSettings.value })
        .from(siteSettings)
        .where(eq(siteSettings.key, SEEDED_AT_KEY));
      const summary = await fullSeed();
      expect(summary.created).toBe(0);
      expect(summary.rows.every((r) => r.created === 0)).toBe(true);
      expect(await snapshot()).toEqual(before);
      const [seededAtAfter] = await db
        .select({ value: siteSettings.value })
        .from(siteSettings)
        .where(eq(siteSettings.key, SEEDED_AT_KEY));
      expect(seededAtAfter?.value).toBe(seededAtBefore?.value);
    },
    SLOW,
  );
});

describe("runAnonymise()", () => {
  it(
    "replaces customer PII, keeps admins, row counts and foreign keys",
    async () => {
      const jane = await createUser(
        { email: "jane.doe@example.com", name: "Jane Doe", phoneNumber: "+919876543210" },
        db,
      );
      const lead = await createLead(
        { name: "Jane Doe", email: "jane.doe@example.com", phone: "+919876543210" },
        db,
      );
      const guestQuery = await createQuery({ guestEmail: "guest@example.com" }, db);
      const [prompt] = await db.select().from(promptVersions);
      const conversation = await createConversation(
        { userId: jane.id, promptVersionId: prompt!.id },
        db,
      );
      await db.insert(chatMessages).values({
        conversationId: conversation.id,
        role: "user",
        content: "my phone is +919876543210",
      });
      const before = await snapshot();

      const summary = await runAnonymise({ db });
      expect(summary.users).toBe(4); // jane + buyer@, unverified@, suspended@ (partner@ is admin)

      expect(await snapshot()).toEqual(before);
      expect(await countRows(db, leads)).toBe(1);
      expect(await countRows(db, queries)).toBe(1);

      const [janeAfter] = await db.select().from(users).where(eq(users.id, jane.id));
      expect(janeAfter?.email).toMatch(/^user-\d+@anon\.invalid$/);
      expect(janeAfter?.name).toMatch(/^User \d+$/);
      expect(janeAfter?.phoneNumber).toBeNull();
      const customerEmails = await db
        .select({ email: users.email })
        .from(users)
        .where(inArray(users.email, [...Object.values(TEST_USER_EMAILS)]));
      expect(customerEmails.map((u) => u.email)).toEqual([TEST_USER_EMAILS.partner]);
      const admins = await db
        .select({ email: users.email })
        .from(users)
        .where(inArray(users.email, [...ADMIN_EMAILS]));
      expect(admins).toHaveLength(2);

      const [leadAfter] = await db.select().from(leads).where(eq(leads.id, lead.id));
      expect(leadAfter?.email).toMatch(/^lead-\d+@anon\.invalid$/);
      expect(leadAfter?.phone).toBeNull();
      expect(leadAfter?.name).toMatch(/^Lead \d+$/);
      const [queryAfter] = await db.select().from(queries).where(eq(queries.id, guestQuery.id));
      expect(queryAfter?.guestEmail).toMatch(/^guest-\d+@anon\.invalid$/);
      const messages = await db
        .select({ content: chatMessages.content })
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conversation.id));
      expect(messages).toEqual([{ content: "[redacted]" }]);

      // re-runnable
      const again = await runAnonymise({ db });
      expect(again.users).toBe(4);
    },
    SLOW,
  );

  it("refuses to run in production", async () => {
    process.env.APP_ENV = "production";
    try {
      await expect(runAnonymise({ db })).rejects.toThrow(/production/);
    } finally {
      process.env.APP_ENV = "local";
    }
  });
});

describe("runSeed({ mode: 'production' })", () => {
  it("refuses without a password", async () => {
    await expect(runSeed({ db, mode: "production", adminEmails: ADMIN_EMAILS })).rejects.toThrow(
      /SEED_ADMIN_PASSWORD/,
    );
  });

  it(
    "writes only permissions, the two Super Admins + partners and settings",
    async () => {
      await truncateAll();
      const summary = await runSeed({
        db,
        mode: "production",
        adminEmails: ADMIN_EMAILS,
        adminPassword: PASSWORD,
      });
      expect(summary.mode).toBe("production");
      const counts = await snapshot();
      expect(counts.permissions).toBe(51);
      expect(counts.users).toBe(2);
      expect(counts.partners).toBe(2);
      expect(counts.products).toBe(0);
      expect(counts.categories).toBe(0);
      expect(counts.landing_chapters).toBe(0);
      expect(counts.services).toBe(0);
      expect(counts.legal_pages).toBe(0);
      expect(counts.coupons).toBe(0);
      expect(counts.prompt_versions).toBe(0);
      expect(counts.fx_rates).toBe(0);
      expect(counts.site_settings).toBe(Object.keys(SITE_SETTING_KEYS).length + 2);
      const partnerRows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, TEST_USER_EMAILS.partner));
      expect(partnerRows).toHaveLength(0);

      const again = await runSeed({
        db,
        mode: "production",
        adminEmails: ADMIN_EMAILS,
        adminPassword: PASSWORD,
      });
      expect(again.created).toBe(0);
      expect(await snapshot()).toEqual(counts);
    },
    SLOW,
  );
});
