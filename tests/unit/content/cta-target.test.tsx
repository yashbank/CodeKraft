import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { resolveCtaHref } from "@/components/admin/content/cta-targets";
import { LandingHero } from "@/components/site/landing/LandingHero";
import { hrefSchema } from "@/modules/content/contracts";

vi.mock("@/components/site/InquirySheet", () => ({ InquirySheet: () => null }));

const who = { eyebrow: "e", title: "A b c d", subtitle: "s", body: "", poster: null };

describe("CTA target validation", () => {
  it("accepts internal paths and http(s) URLs", () => {
    expect(hrefSchema.safeParse("/contact").success).toBe(true);
    expect(hrefSchema.safeParse("https://x.y").success).toBe(true);
    expect(resolveCtaHref("other", "https://x.y")).toBe("https://x.y");
    expect(resolveCtaHref("/contact", "")).toBe("/contact");
  });
  it("rejects javascript:, data: and protocol-relative targets", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.com", "/\\evil.com"]) {
      expect(hrefSchema.safeParse(bad).success).toBe(false);
      expect(resolveCtaHref("other", bad)).toBeNull();
    }
  });
});

describe("LandingHero stored CTA", () => {
  it("renders the stored labels and hrefs", () => {
    const html = renderToStaticMarkup(
      <LandingHero
        content={{
          ...who,
          cta: {
            primary: { label: "Go pricing", href: "/services" },
            secondary: { label: "Read more", href: "https://x.y" },
          },
        }}
        logos={[]}
        serviceOptions={[]}
      />,
    );
    expect(html).toContain('href="/services"');
    expect(html).toContain("Go pricing");
    expect(html).toContain('href="https://x.y"');
    expect(html).toContain("Read more");
  });
  it("falls back to defaults when nothing is stored", () => {
    const html = renderToStaticMarkup(<LandingHero content={who} logos={[]} serviceOptions={[]} />);
    expect(html).toContain("Start a project");
    expect(html).toContain('href="/products"');
  });
});
