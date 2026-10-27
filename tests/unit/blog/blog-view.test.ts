import { describe, expect, it } from "vitest";
import { readingMinutes, toBlogPost, toBlogTeaser } from "@/lib/blog-view";

const card = {
  slug: "a-post",
  title: "A post",
  excerpt: null,
  cover: null,
  publishedAt: "2026-09-18T00:00:00.000Z",
  product: { slug: "p", name: "P" },
  author: { name: "CodeKraft" },
};

describe("blog-view", () => {
  it("maps a card to a teaser with safe defaults", () => {
    const t = toBlogTeaser(card);
    expect(t.excerpt).toBe("");
    expect(t.coverAlt).toBe("A post");
    expect(t.product.slug).toBe("p");
    expect(t.readingMinutes).toBe(1);
  });
  it("computes reading time from html, min 1", () => {
    expect(readingMinutes("<p>short</p>")).toBe(1);
    expect(readingMinutes(`<p>${"word ".repeat(450)}</p>`)).toBe(3);
  });
  it("attaches body html", () => {
    expect(toBlogPost(toBlogTeaser(card), "<p>x</p>").bodyHtml).toBe("<p>x</p>");
  });
});
