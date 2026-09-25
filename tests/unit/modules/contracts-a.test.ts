/**
 * P2.5 contracts A — Zod schemas of catalog, offerings, media, content, blog, ownership, settings,
 * fx, search, users (docs/06 §1.3, §1.8, §2). Fixtures are copied from the docs/06 rows.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as catalog from "@/modules/catalog/contracts";
import * as offerings from "@/modules/offerings/contracts";
import * as media from "@/modules/media/contracts";
import * as content from "@/modules/content/contracts";
import * as blog from "@/modules/blog/contracts";
import * as ownership from "@/modules/ownership/contracts";
import * as settings from "@/modules/settings/contracts";
import * as fx from "@/modules/fx/contracts";
import * as search from "@/modules/search/contracts";
import * as users from "@/modules/users/contracts";
import { PRODUCT_STATUSES } from "@/modules/catalog/types";
import { SITE_SETTING_KEYS } from "@/modules/settings/types";

const ID = "3f2b7c1e-8a4d-4c1a-9f6e-2d5b8a7c4e10";
const ID2 = "9a1c4e2b-6d7f-4a3b-8c5d-1e2f3a4b5c6d";
const doc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
};

const ok = <S extends z.ZodType>(schema: S, value: unknown) => {
  const r = schema.safeParse(value);
  if (!r.success) throw new Error(JSON.stringify(r.error.issues, null, 1));
  return r.data as z.output<S>;
};
const bad = (schema: z.ZodType, value: unknown) =>
  expect(schema.safeParse(value).success).toBe(false);

describe("every `*Schema` export is a Zod schema", () => {
  const modules = {
    catalog,
    offerings,
    media,
    content,
    blog,
    ownership,
    settings,
    fx,
    search,
    users,
  };
  for (const [name, mod] of Object.entries(modules)) {
    it(name, () => {
      const names = Object.keys(mod).filter((k) => k.endsWith("Schema"));
      expect(names.length).toBeGreaterThan(0);
      for (const k of names)
        expect((mod as Record<string, unknown>)[k], k).toBeInstanceOf(z.ZodType);
    });
  }
});

describe("shared primitives (docs/06 §1.3)", () => {
  it("slug", () => {
    for (const s of ["a", "abc-123", "x1-y2-z3"]) ok(catalog.slugSchema, s);
    for (const s of ["", "-a", "a-", "a--b", "A", "a b", "a_b", "a".repeat(81)])
      bad(catalog.slugSchema, s);
  });
  it("money is integer minor units in a supported currency", () => {
    ok(catalog.moneySchema, { amountMinor: 0, currency: "INR" });
    bad(catalog.moneySchema, { amountMinor: 1.5, currency: "INR" });
    bad(catalog.moneySchema, { amountMinor: -1, currency: "INR" });
    bad(catalog.moneySchema, { amountMinor: 100, currency: "JPY" });
    bad(catalog.moneySchema, { amountMinor: 100, currency: "INR", extra: 1 });
  });
  it("bps 0..10000", () => {
    ok(catalog.bpsSchema, 0);
    ok(catalog.bpsSchema, 10_000);
    bad(catalog.bpsSchema, 10_001);
    bad(catalog.bpsSchema, -1);
    bad(catalog.bpsSchema, 12.5);
  });
  it("iso dates", () => {
    ok(catalog.isoDateTimeSchema, "2026-09-24T10:15:00.000Z");
    bad(catalog.isoDateTimeSchema, "2026-09-24 10:15");
    ok(catalog.isoDateSchema, "2026-09-24");
    bad(catalog.isoDateSchema, "24/09/2026");
  });
  it("rich text allow-list rejects script/iframe nodes and javascript: links", () => {
    ok(catalog.richTextSchema, doc);
    bad(catalog.richTextSchema, { type: "doc", content: [{ type: "script", text: "x" }] });
    bad(catalog.richTextSchema, {
      type: "doc",
      content: [{ type: "iframe", attrs: { src: "https://e.com" } }],
    });
    bad(catalog.richTextSchema, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    });
    ok(catalog.richTextSchema, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x",
              marks: [{ type: "link", attrs: { href: "https://codekraft.in" } }],
            },
          ],
        },
      ],
    });
  });
  it("list params (docs/06 §1.8)", () => {
    const s = catalog.listParams(["updatedAt"], z.strictObject({ q: z.string().optional() }));
    expect(ok(s, {}).limit).toBe(25);
    ok(s, { sort: "updatedAt:desc", limit: 100, cursor: "abc", filters: { q: "x" } });
    bad(s, { sort: "name:asc" });
    bad(s, { limit: 101 });
    bad(s, { limit: 0 });
    bad(s, { filters: { nope: 1 } });
  });
});

describe("catalog", () => {
  it("API-CAT-01 createProduct", () => {
    ok(catalog.createProductSchema, {
      name: "Ledger",
      slug: "ledger",
      shortDescription: "A",
      tags: ["saas"],
    });
    bad(catalog.createProductSchema, { name: "Ledger", slug: "Ledger", shortDescription: "A" });
    bad(catalog.createProductSchema, { slug: "ledger", shortDescription: "A" });
    bad(catalog.createProductSchema, {
      name: "L",
      slug: "l",
      shortDescription: "A",
      status: "published",
    });
  });
  it("API-CAT-02 updateProduct needs a non-empty patch and expectedUpdatedAt", () => {
    ok(catalog.updateProductSchema, {
      productId: ID,
      expectedUpdatedAt: "2026-09-24T10:15:00.000Z",
      patch: { isFeatured: true },
    });
    bad(catalog.updateProductSchema, {
      productId: ID,
      expectedUpdatedAt: "2026-09-24T10:15:00.000Z",
      patch: {},
    });
    bad(catalog.updateProductSchema, { productId: ID, patch: { name: "x" } });
    bad(catalog.updateProductSchema, {
      productId: ID,
      expectedUpdatedAt: "2026-09-24T10:15:00.000Z",
      patch: { status: "published" },
    });
  });
  it("API-CAT-07 semver", () => {
    ok(catalog.createProductVersionSchema, {
      productId: ID,
      version: "1.2.0",
      changelogJson: { summary: "x" },
    });
    bad(catalog.createProductVersionSchema, { productId: ID, version: "v1.2", changelogJson: {} });
  });
  it("API-CAT-11/18/20/35", () => {
    ok(catalog.submitForApprovalSchema, { productId: ID, publishAt: "2026-10-01T00:00:00.000Z" });
    ok(catalog.listProductsAdminSchema, { filters: { status: "draft" }, sort: "name:asc" });
    bad(catalog.listProductsAdminSchema, { filters: { status: "live" } });
    ok(catalog.upsertCategorySchema, { name: "Tools", slug: "tools", position: 0, parentId: null });
    ok(catalog.toggleWishlistSchema, { productId: ID, on: true });
    bad(catalog.toggleWishlistSchema, { productId: "1", on: true });
    expect(PRODUCT_STATUSES).toHaveLength(6);
  });
});

describe("offerings", () => {
  const base = {
    productId: ID,
    name: "Pro",
    slug: "pro",
    position: 0,
    isDefault: true,
    purchaseModel: "one_time",
    deliveryType: "download",
    deliveryConfig: {
      provisioning: "manual",
      downloadCap: 5,
      accessMonths: null,
      updatePolicy: "all_free",
    },
    status: "active",
  };
  it("API-CAT-03 cross-field rules", () => {
    ok(offerings.upsertOfferingSchema, base);
    bad(offerings.upsertOfferingSchema, { ...base, purchaseModel: "subscription" });
    ok(offerings.upsertOfferingSchema, {
      ...base,
      purchaseModel: "subscription",
      billingInterval: "monthly",
    });
    bad(offerings.upsertOfferingSchema, { ...base, deliveryType: "service" });
    ok(offerings.upsertOfferingSchema, {
      ...base,
      deliveryType: "service",
      serviceSteps: [{ key: "kickoff", title: "Kickoff" }],
    });
    bad(offerings.upsertOfferingSchema, { ...base, deliveryType: "ftp" });
  });
  it("API-CAT-04 prices: compareAt > amount, one row per currency", () => {
    ok(offerings.setOfferingPricesSchema, {
      offeringId: ID,
      prices: [{ currency: "INR", amountMinor: 99900, compareAtMinor: 129900 }],
    });
    bad(offerings.setOfferingPricesSchema, {
      offeringId: ID,
      prices: [{ currency: "INR", amountMinor: 99900, compareAtMinor: 99900 }],
    });
    bad(offerings.setOfferingPricesSchema, {
      offeringId: ID,
      prices: [
        { currency: "INR", amountMinor: 1 },
        { currency: "INR", amountMinor: 2 },
      ],
    });
    bad(offerings.setOfferingPricesSchema, {
      offeringId: ID,
      prices: [{ currency: "INR", amountMinor: 10.5 }],
    });
    bad(offerings.setOfferingPricesSchema, { offeringId: ID, prices: [] });
  });
  it("API-CAT-05 methods", () => {
    ok(offerings.setOfferingPaymentMethodsSchema, {
      offeringId: ID,
      methods: ["manual_upi", "manual_bank"],
    });
    bad(offerings.setOfferingPaymentMethodsSchema, {
      offeringId: ID,
      methods: ["manual_upi", "manual_upi"],
    });
    bad(offerings.setOfferingPaymentMethodsSchema, { offeringId: ID, methods: ["cash"] });
  });
});

describe("media", () => {
  it("API-CAT-06 alt required for image kinds; embed host allow-list", () => {
    ok(media.attachProductMediaSchema, {
      productId: ID,
      kind: "image",
      mediaId: ID2,
      alt: "Hero",
      position: 0,
    });
    bad(media.attachProductMediaSchema, {
      productId: ID,
      kind: "image",
      mediaId: ID2,
      position: 0,
    });
    ok(media.attachProductMediaSchema, {
      productId: ID,
      kind: "attachment",
      mediaId: ID2,
      position: 1,
    });
    ok(media.attachProductMediaSchema, {
      productId: ID,
      kind: "video_embed",
      embedUrl: "https://www.youtube.com/watch?v=x",
      position: 0,
    });
    bad(media.attachProductMediaSchema, {
      productId: ID,
      kind: "video_embed",
      embedUrl: "https://evil.example/x",
      position: 0,
    });
    bad(media.attachProductMediaSchema, {
      productId: ID,
      kind: "video_embed",
      mediaId: ID2,
      position: 0,
    });
  });
  it("§3.5 upload intent: mime allow-list and size cap per purpose", () => {
    ok(media.createUploadIntentSchema, {
      purpose: "product_image",
      filename: "a.png",
      mime: "image/png",
      sizeBytes: 1024,
    });
    bad(media.createUploadIntentSchema, {
      purpose: "product_image",
      filename: "a.svg",
      mime: "image/svg+xml",
      sizeBytes: 1024,
    });
    bad(media.createUploadIntentSchema, {
      purpose: "product_image",
      filename: "a.png",
      mime: "image/png",
      sizeBytes: 11 * 1024 * 1024,
    });
    bad(media.createUploadIntentSchema, {
      purpose: "product_presentation",
      filename: "a.pdf",
      mime: "image/png",
      sizeBytes: 10,
    });
    bad(media.createUploadIntentSchema, {
      purpose: "avatar",
      filename: "../a.png",
      mime: "image/png",
      sizeBytes: 10,
    });
  });
});

describe("content", () => {
  it("API-CONT-01 landing chapter keys", () => {
    const chapter = {
      key: "who",
      title: "Who",
      bodyJson: doc,
      media: {},
      cta: { primary: { label: "Go", href: "/products" } },
      position: 0,
      published: true,
    };
    ok(content.upsertLandingChapterSchema, chapter);
    bad(content.upsertLandingChapterSchema, { ...chapter, key: "hero" });
    bad(content.upsertLandingChapterSchema, {
      ...chapter,
      cta: { primary: { label: "Go", href: "javascript:x" } },
    });
  });
  it("API-CONT-02 ≤ 8 featured, unique", () => {
    ok(content.setFeaturedProductsSchema, { productIds: [ID, ID2] });
    bad(content.setFeaturedProductsSchema, { productIds: [ID, ID] });
    bad(content.setFeaturedProductsSchema, { productIds: Array.from({ length: 9 }, () => ID) });
  });
  it("API-CONT-05/07/08 scopes", () => {
    bad(content.upsertTestimonialSchema, {
      quote: "q",
      authorName: "a",
      context: "product",
      position: 0,
      published: true,
    });
    ok(content.upsertTestimonialSchema, {
      quote: "q",
      authorName: "a",
      context: "product",
      productId: ID,
      position: 0,
      published: true,
    });
    bad(content.upsertFaqSchema, {
      question: "q",
      answerJson: doc,
      scope: "product",
      position: 0,
      published: false,
    });
    ok(content.upsertFaqSchema, {
      question: "q",
      answerJson: doc,
      scope: "chatbot",
      position: 0,
      published: false,
    });
    ok(content.updateLegalPageSchema, { key: "refunds", title: "Refunds", bodyJson: doc });
    bad(content.updateLegalPageSchema, { key: "cookies", title: "x", bodyJson: doc });
  });
});

describe("blog", () => {
  it("API-CAT-10", () => {
    ok(blog.upsertProductBlogSchema, {
      productId: ID,
      slug: "ledger-launch",
      title: "T",
      excerpt: "E",
      bodyJson: doc,
    });
    bad(blog.upsertProductBlogSchema, {
      productId: ID,
      slug: "Ledger Launch",
      title: "T",
      excerpt: "E",
      bodyJson: doc,
    });
    ok(blog.listBlogPostsSchema, { sort: "publishedAt:desc" });
  });
});

describe("ownership", () => {
  it("API-CAT-16 lines are range-checked; the 10000 sum is a service rule", () => {
    const lines = [
      { partnerId: ID, shareBps: 6000 },
      { partnerId: ID2, shareBps: 3000 },
    ];
    ok(ownership.proposeOwnershipSchema, {
      productId: ID,
      companyCutBps: 1000,
      lines,
      effectiveFrom: "2026-10-01T00:00:00.000Z",
    });
    expect(ownership.sumsToTotal(lines)).toBe(false);
    expect(ownership.sumsToTotal([{ shareBps: 10_000 }])).toBe(true);
    bad(ownership.proposeOwnershipSchema, {
      productId: ID,
      companyCutBps: 1000,
      lines: [{ partnerId: ID, shareBps: 0 }],
    });
    bad(ownership.proposeOwnershipSchema, { productId: ID, companyCutBps: 10_001, lines });
    bad(ownership.proposeOwnershipSchema, { productId: ID, companyCutBps: 0, lines: [] });
    bad(ownership.proposeOwnershipSchema, {
      productId: ID,
      companyCutBps: 0,
      lines: [
        { partnerId: ID, shareBps: 5000 },
        { partnerId: ID, shareBps: 5000 },
      ],
    });
  });
  it("API-CAT-17 payload", () => {
    ok(ownership.ownershipChangePayloadSchema, { ownershipId: ID, productId: ID2 });
    bad(ownership.ownershipChangePayloadSchema, { ownershipId: ID });
  });
});

describe("settings", () => {
  it("API-ADM-10 typed map and patch", () => {
    ok(settings.siteSettingsSchema, settings.SITE_SETTINGS_DEFAULTS);
    ok(settings.updateSettingsSchema, {
      patch: {
        taxRateBps: 1800,
        gstin: "27AAPFU0939F1ZV",
        upiVpa: "codekraft@upi",
        flags: { bundles: true },
      },
    });
    bad(settings.updateSettingsSchema, { patch: {} });
    bad(settings.updateSettingsSchema, { patch: { gstin: "bad" } });
    bad(settings.updateSettingsSchema, { patch: { taxRateBps: 10_001 } });
    bad(settings.updateSettingsSchema, {
      patch: { baseCurrency: "USD", enabledCurrencies: ["INR"] },
    });
    bad(settings.updateSettingsSchema, { patch: { flags: { unknown_flag: true } } });
    bad(settings.updateSettingsSchema, { patch: { defaultTheme: "neon" } });
    expect(Object.keys(SITE_SETTING_KEYS).sort()).toEqual(
      Object.keys(settings.siteSettingsSchema.shape).sort(),
    );
  });
  it("API-AUTH-10 visitor preferences", () => {
    ok(settings.setVisitorPreferencesSchema, { displayCurrency: "USD" });
    bad(settings.setVisitorPreferencesSchema, {});
    bad(settings.setVisitorPreferencesSchema, { theme: "sepia" });
  });
});

describe("fx", () => {
  it("API-FIN-12 override: 8-decimal string, quote ≠ INR, YYYY-MM-DD", () => {
    ok(fx.setFxOverrideSchema, { quote: "USD", rate: "0.01200000", asOf: "2026-09-25" });
    bad(fx.setFxOverrideSchema, { quote: "INR", rate: "1", asOf: "2026-09-25" });
    bad(fx.setFxOverrideSchema, { quote: "USD", rate: 0.012, asOf: "2026-09-25" });
    bad(fx.setFxOverrideSchema, { quote: "USD", rate: "0.123456789", asOf: "2026-09-25" });
    bad(fx.setFxOverrideSchema, { quote: "USD", rate: "0", asOf: "2026-09-25" });
    expect(typeof fx.getFxProvider().getRate).toBe("function");
  });
});

describe("search", () => {
  it("API-CAT-30 filters / sort / pagination", () => {
    const parsed = ok(search.listProductsSchema, {
      displayCurrency: "INR",
      q: "ledger",
      filters: { categorySlug: "tools", priceMin: 0, priceMax: 500000, techStack: ["nextjs"] },
    });
    expect(parsed.sort).toBe("featured");
    expect(parsed.limit).toBe(25);
    bad(search.listProductsSchema, { displayCurrency: "INR", sort: "cheapest" });
    bad(search.listProductsSchema, {
      displayCurrency: "INR",
      filters: { priceMin: 10, priceMax: 5 },
    });
    bad(search.listProductsSchema, { displayCurrency: "INR", filters: { status: "draft" } });
    bad(search.listProductsSchema, { q: "x" });
  });
});

describe("users", () => {
  it("API-AUTH-03/04/08", () => {
    ok(users.updateProfileSchema, {
      name: "Pravin",
      billing: { billingName: "Pravin", country: "in", gstNumber: "27AAPFU0939F1ZV" },
    });
    bad(users.updateProfileSchema, { name: "", billing: { billingName: "P", country: "IN" } });
    bad(users.updateProfileSchema, { name: "P", billing: { billingName: "P", country: "IND" } });
    ok(users.updateAccountSettingsSchema, { themePref: null });
    bad(users.updateAccountSettingsSchema, {});
    ok(users.deleteAccountSchema, { confirmPhrase: "DELETE", password: "x" });
    bad(users.deleteAccountSchema, { confirmPhrase: "delete" });
  });
  it("API-ADM-06/11/12", () => {
    ok(users.listCustomersSchema, {
      filters: { hasOrders: true, country: "IN" },
      sort: "lastOrderAt:desc",
      q: "pravin",
    });
    bad(users.listCustomersSchema, { sort: "email:asc" });
    ok(users.inviteAdminSchema, { email: "a@b.co", role: "admin", partner: { displayName: "A" } });
    bad(users.inviteAdminSchema, { email: "a@b.co", role: "customer" });
    ok(users.adminUserChangePayloadSchema, { op: "remove", userId: ID });
    bad(users.adminUserChangePayloadSchema, { op: "promote", userId: ID });
    bad(users.updatePartnerSchema, { partnerId: ID });
    ok(users.updatePartnerSchema, {
      partnerId: ID,
      payoutBankDetails: {
        accountName: "A",
        accountNumber: "123456789",
        ifsc: "HDFC0001234",
        bankName: "HDFC",
      },
    });
  });
});
