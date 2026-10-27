import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/blog/queries", () => ({
  listBlogPostsQuery: vi.fn(async () => ({
    ok: true,
    data: { items: [{ slug: "real-post", publishedAt: "2026-09-18T00:00:00.000Z" }] },
  })),
}));
vi.mock("@/modules/catalog/queries", () => ({
  listProductsQuery: vi.fn(async () => ({ ok: true, data: [{ slug: "real-product" }] })),
}));
vi.mock("@/modules/content/queries", () => ({
  listCaseStudiesQuery: vi.fn(async () => ({ ok: true, data: { items: [{ slug: "real-case" }] } })),
}));

import sitemap from "@/app/sitemap";

describe("sitemap (BUG-076)", () => {
  it("lists DB content only and no fixture slugs or missing routes", async () => {
    const urls = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(urls).toContain("/blog/real-post");
    expect(urls).toContain("/products/real-product");
    expect(urls).toContain("/projects/real-case");
    expect(urls).not.toContain("/about");
    expect(urls).not.toContain("/case-studies");
    expect(urls).not.toContain("/blog/how-fitdesk-pro-collects-fees-on-upi");
  });
});
