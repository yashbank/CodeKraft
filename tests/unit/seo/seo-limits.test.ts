// @vitest-environment node
import { describe, expect, it } from "vitest";

import { pageMetadata, seoSnippet } from "@/lib/seo";
import { isValidSlug, slugify } from "@/modules/catalog/slugs";
import { upsertProductBlogSchema } from "@/modules/blog/contracts";
import {
  SEO_DESCRIPTION_HINT,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  SLUG_MAX,
} from "@/modules/_shared/zod";

const base = {
  productId: "7b0f1b5e-2f0e-4f0e-8f0e-0f0e1b5e2f0e",
  slug: "a".repeat(SLUG_MAX),
  title: "T",
  excerpt: "E",
  bodyJson: { type: "doc", content: [] },
};

describe("SEO limits agree end to end", () => {
  it("auto-generated slugs stay valid for a long title", () => {
    const slug = slugify(`${"word ".repeat(23)}abcdefghij klm`);
    expect(slug.length).toBeLessThanOrEqual(120);
    expect(slug.endsWith("-")).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
  });

  it("blog schema accepts the hard max and rejects one past it", () => {
    const ok = {
      ...base,
      seoTitle: "t".repeat(SEO_TITLE_MAX),
      seoDescription: "d".repeat(SEO_DESCRIPTION_MAX),
    };
    expect(upsertProductBlogSchema.safeParse(ok).success).toBe(true);
    expect(
      upsertProductBlogSchema.safeParse({ ...ok, seoTitle: "t".repeat(SEO_TITLE_MAX + 1) }).success,
    ).toBe(false);
    expect(
      upsertProductBlogSchema.safeParse({ ...ok, slug: "a".repeat(SLUG_MAX + 1) }).success,
    ).toBe(false);
  });

  it("meta description is not cut below the hard max; preview warns past the hint", () => {
    const description = "word ".repeat(70).trim(); // 349 chars
    const m = pageMetadata({ path: "/x", title: "T", description });
    expect(m.description).toBe(description);
    const s = seoSnippet(m, "CK");
    expect(s.warnings.some((w) => w.includes(String(SEO_DESCRIPTION_HINT)))).toBe(true);
    expect(s.description.length).toBeLessThanOrEqual(SEO_DESCRIPTION_HINT);
  });
});
