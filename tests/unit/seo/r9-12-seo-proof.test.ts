/** R9-12 — per page type: title, description, canonical, JSON-LD come from the builders. */
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const product = {
  slug: "acme-crm",
  name: "Acme CRM",
  shortDescription: "Short blurb",
  isFeatured: false,
  isComingSoon: false,
  isRefundable: true,
  offerings: [],
  media: [],
  faqs: [],
  versions: [],
  testimonials: [],
  tags: [],
  techStack: [],
  industry: [],
  targetAudience: [],
  benefits: [],
  useCases: [],
  features: [],
  requirements: null,
  description: { type: "doc", content: [] },
  category: null,
  currentVersion: "1.0.0",
  liveDemoUrl: null,
  seo: { title: "Custom SEO title", description: "Custom SEO description" },
};
vi.mock("@/modules/catalog/queries", () => ({
  getProductBySlugQuery: vi.fn(async () => ({ ok: true, data: product })),
}));
vi.mock("@/lib/authz/context", () => ({ anonymousContext: () => ({}) }));
vi.mock("@/lib/display-currency", () => ({
  getDisplayCurrency: async () => ({ currency: "INR" }),
}));
vi.mock("@/lib/site-brand", () => ({
  getSiteName: async () => "CodeKraft",
  getSiteLogo: async () => null,
}));

import {
  absoluteUrl,
  articleLd,
  blogSeo,
  caseStudySeo,
  organizationLd,
  pageMetadata,
  productLd,
  productSeo,
  seoSnippet,
  truncate,
} from "@/lib/seo";

describe("R9-12 SEO builders", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.test/";
  });

  it("product page metadata uses the admin SEO title/description and a canonical", async () => {
    const { generateMetadata } = await import("@/app/(site)/products/[slug]/page");
    const m = await generateMetadata({ params: Promise.resolve({ slug: "acme-crm" }) });
    expect(m.title).toBe("Custom SEO title");
    expect(m.description).toBe("Custom SEO description");
    expect(m.alternates?.canonical).toBe("https://example.test/products/acme-crm");
  });

  it("per-type resolvers fall back from SEO fields to content fields and set canonical paths", () => {
    expect(productSeo({ slug: "p", name: "P", shortDescription: "d" })).toMatchObject({
      path: "/products/p",
      title: "P",
      description: "d",
    });
    expect(blogSeo({ slug: "b", title: "B", excerpt: "e", seoTitle: "SB" })).toMatchObject({
      path: "/blog/b",
      title: "SB",
      description: "e",
      type: "article",
    });
    expect(
      caseStudySeo({ slug: "c", title: "C", resultHighlight: "r", seoDescription: "" }),
    ).toMatchObject({
      path: "/projects/c",
      title: "C",
      description: "r",
    });
  });

  it("seoSnippet reads the same metadata and warns past 60/160 chars", () => {
    const ok = seoSnippet(
      pageMetadata(productSeo({ slug: "p", name: "P", shortDescription: "d" })),
      "CK",
    );
    expect(ok).toMatchObject({
      title: "P · CK",
      url: "https://example.test/products/p",
      warnings: [],
    });
    const long = seoSnippet(
      pageMetadata({ path: "/x", title: "t".repeat(70), description: "d ".repeat(100) }),
      "CK",
    );
    expect(long.warnings.length).toBe(2);
    expect(long.title.length).toBeLessThanOrEqual(61);
  });

  it("home metadata has canonical; Organization JSON-LD has name/url/logo", () => {
    const m = pageMetadata({ path: "/", title: "T", description: "D" });
    expect(m.alternates?.canonical).toBe("https://example.test/");
    expect(organizationLd("CodeKraft", "/logo.png")).toMatchObject({
      "@type": "Organization",
      name: "CodeKraft",
      logo: "https://example.test/logo.png",
    });
  });

  it("Product / Article JSON-LD carry type, url and dates", () => {
    expect(
      productLd({ slug: "a", name: "A", price: { amountMinor: 1000, currency: "INR" } }),
    ).toMatchObject({
      "@type": "Product",
      url: "https://example.test/products/a",
      offers: { price: "10.00", priceCurrency: "INR" },
    });
    expect(
      articleLd({ type: "BlogPosting", path: "/blog/x", title: "X", datePublished: "2026-01-01" }),
    ).toMatchObject({
      "@type": "BlogPosting",
      mainEntityOfPage: "https://example.test/blog/x",
      dateModified: "2026-01-01",
    });
    expect(articleLd({ type: "Article", path: "/projects/y", title: "Y" })["@type"]).toBe(
      "Article",
    );
  });

  it("truncate caps at 155 on a word boundary; absoluteUrl keeps absolute urls", () => {
    expect(truncate("word ".repeat(80))!.length).toBeLessThanOrEqual(155);
    expect(absoluteUrl("https://a.b/c")).toBe("https://a.b/c");
  });
});
