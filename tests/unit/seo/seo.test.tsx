// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const ok = (data: unknown) => ({ ok: true, data });
vi.mock("@/lib/authz/context", () => ({ anonymousContext: () => ({}) }));
vi.mock("@/modules/catalog/queries", () => ({
  getProductBySlugQuery: vi.fn(),
  listProductsQuery: vi.fn(),
}));
vi.mock("@/modules/blog/queries", () => ({
  getBlogBySlugQuery: vi.fn(),
  listBlogPostsQuery: vi.fn(),
}));
vi.mock("@/modules/content/queries", () => ({
  getCaseStudyBySlugQuery: vi.fn(),
  listCaseStudiesQuery: vi.fn(),
}));
vi.mock("@/lib/site-brand", () => ({
  getSiteName: async () => "Acme",
  getSiteLogo: async () => null,
  getThemeConfig: async () => ({ palette: "violet" }),
}));
vi.mock("next/og", () => ({
  ImageResponse: class ImageResponse extends Response {
    constructor() {
      super("png", { headers: { "content-type": "image/png" } });
    }
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import BlogOg from "@/app/(site)/blog/[slug]/opengraph-image";
import { generateMetadata as blogMeta } from "@/app/(site)/blog/[slug]/page";
import { generateMetadata as caseMeta } from "@/app/(site)/projects/[slug]/page";
import { generateMetadata as productMeta } from "@/app/(site)/products/[slug]/page";
import ProductOg from "@/app/(site)/products/[slug]/opengraph-image";
import { getBlogBySlugQuery, listBlogPostsQuery } from "@/modules/blog/queries";
import { getProductBySlugQuery, listProductsQuery } from "@/modules/catalog/queries";
import { getCaseStudyBySlugQuery, listCaseStudiesQuery } from "@/modules/content/queries";
import {
  articleLd,
  breadcrumbLd,
  faqLd,
  productLd,
  safeJsonLd,
  truncate,
  websiteLd,
} from "@/lib/seo";

const params = Promise.resolve({ slug: "x" });

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
  vi.mocked(getProductBySlugQuery).mockResolvedValue(
    ok({
      id: "1",
      slug: "x",
      name: "Widget",
      shortDescription: "A widget",
      offerings: [],
      media: [],
      faqs: [],
      versions: [],
      tags: [],
      techStack: [],
      industry: [],
      targetAudience: [],
      benefits: [],
      features: [],
      requirements: [],
      useCases: [],
      description: null,
      testimonials: [],
      category: null,
    }) as never,
  );
  vi.mocked(getBlogBySlugQuery).mockResolvedValue(
    ok({ blog: { title: "Post", seoTitle: null, seoDescription: null, excerpt: "Ex" } }) as never,
  );
  vi.mocked(getCaseStudyBySlugQuery).mockResolvedValue(
    ok({
      title: "Study",
      seo: { title: "Study", description: "" },
      resultHighlight: "+40%",
    }) as never,
  );
});

describe("generateMetadata", () => {
  it("blog + case study return canonical, OG and twitter", async () => {
    const b = await blogMeta({ params });
    expect(b.alternates?.canonical).toBe("https://example.com/blog/x");
    expect(b.openGraph).toMatchObject({ type: "article", url: "https://example.com/blog/x" });
    expect(b.twitter).toMatchObject({ card: "summary_large_image", title: "Post" });
    const c = await caseMeta({ params });
    expect(c.alternates?.canonical).toBe("https://example.com/projects/x");
    expect(c.description).toBe("+40%");
  });

  it("product has canonical + OG and is indexable", async () => {
    const m = await productMeta({ params });
    expect(m.alternates?.canonical).toBe("https://example.com/products/x");
    expect(m.openGraph).toMatchObject({ title: "Widget" });
    expect(m.robots).toBeUndefined();
  });

  it("missing case study is noindex", async () => {
    vi.mocked(getCaseStudyBySlugQuery).mockResolvedValue({ ok: false } as never);
    expect((await caseMeta({ params })).robots).toMatchObject({ index: false });
  });
});

describe("JSON-LD", () => {
  it("escapes </script and <!--", () => {
    const out = safeJsonLd({ a: "</script><script>alert(1)</script><!--" });
    expect(out).not.toContain("</script");
    expect(out).not.toContain("<!--");
    expect(JSON.parse(out).a).toContain("</script>");
  });

  it("builders produce valid shapes", () => {
    const p = productLd({ slug: "x", name: "W", price: { amountMinor: 49900, currency: "INR" } });
    expect(p["@type"]).toBe("Product");
    expect(p.offers).toMatchObject({
      price: "499.00",
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
    });
    expect(articleLd({ type: "BlogPosting", path: "/blog/x", title: "T" })["@type"]).toBe(
      "BlogPosting",
    );
    expect(breadcrumbLd([{ name: "A", path: "/a" }]).itemListElement[0]).toMatchObject({
      position: 1,
      item: "https://example.com/a",
    });
    expect(faqLd([{ question: "q", answer: "a" }]).mainEntity[0]?.["@type"]).toBe("Question");
    expect(websiteLd("S").potentialAction["@type"]).toBe("SearchAction");
  });

  it("truncates descriptions to ~155 chars", () => {
    expect(truncate("word ".repeat(100))!.length).toBeLessThanOrEqual(155);
    expect(truncate("  ")).toBeUndefined();
  });
});

describe("sitemap + robots", () => {
  it("lists published items and no private paths", async () => {
    vi.mocked(listProductsQuery).mockResolvedValue(ok([{ slug: "p1" }]) as never);
    vi.mocked(listCaseStudiesQuery).mockResolvedValue(ok({ items: [{ slug: "c1" }] }) as never);
    vi.mocked(listBlogPostsQuery).mockResolvedValue(
      ok({ items: [{ slug: "b1", publishedAt: "2026-01-01" }] }) as never,
    );
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://example.com/products/p1",
        "https://example.com/projects/c1",
        "https://example.com/blog/b1",
        "https://example.com/legal/privacy",
      ]),
    );
    expect(urls.some((u) => /\/(admin|account|checkout|api)/.test(u))).toBe(false);
  });

  it("robots disallows private paths and points to the sitemap", async () => {
    const r = await robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule?.disallow).toEqual(
      expect.arrayContaining(["/admin/", "/account/", "/api/", "/checkout/"]),
    );
    expect(r.sitemap).toBe("https://example.com/sitemap.xml");
  });
});

describe("opengraph-image routes", () => {
  it("return an ImageResponse", async () => {
    const res = await ProductOg({ params });
    expect(res.headers.get("content-type")).toBe("image/png");
    expect((await BlogOg({ params })).status).toBe(200);
  });
});
