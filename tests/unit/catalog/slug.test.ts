import { describe, expect, it } from "vitest";
import { isValidSlug, slugify } from "@/modules/catalog/slugs";

describe("catalog slugs", () => {
  describe("slugify", () => {
    it("converts spaces and special characters to hyphens", () => {
      expect(slugify("My Cool Product!")).toBe("my-cool-product");
      expect(slugify("  Awesome SaaS Template #1  ")).toBe("awesome-saas-template-1");
      expect(slugify("Next.js 15 & PostgreSQL")).toBe("nextjs-15-postgresql");
    });

    it("collapses multiple consecutive dashes", () => {
      expect(slugify("foo---bar___baz")).toBe("foo-bar-baz");
    });

    it("trims leading and trailing dashes", () => {
      expect(slugify("-leading-and-trailing-")).toBe("leading-and-trailing");
    });
  });

  describe("isValidSlug", () => {
    it("accepts valid kebab-case slugs between 3 and 100 characters", () => {
      expect(isValidSlug("saas-starter-kit")).toBe(true);
      expect(isValidSlug("codekraft-pro")).toBe(true);
      expect(isValidSlug("abc")).toBe(true);
    });

    it("rejects invalid slugs", () => {
      expect(isValidSlug("ab")).toBe(false); // too short (< 3)
      expect(isValidSlug("Has Uppercase")).toBe(false);
      expect(isValidSlug("with spaces")).toBe(false);
      expect(isValidSlug("-leading-dash")).toBe(false);
      expect(isValidSlug("trailing-dash-")).toBe(false);
      expect(isValidSlug("consecutive--dashes")).toBe(false);
      expect(isValidSlug("special!chars")).toBe(false);
    });
  });
});
