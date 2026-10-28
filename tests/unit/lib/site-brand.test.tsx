/**
 * R8-11 — the admin-editable site name drives page titles, chrome and outgoing email. Root cause
 * of the bug: "CodeKraft" was hard-coded in the root metadata, header/footer wordmark, admin shell
 * and email layout, so `site_settings.site_name` was saved but never read.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteBrandProvider, SiteName } from "@/components/brand/site-brand";
import { Wordmark } from "@/components/site/Wordmark";
import { brandFromAddress, brandSubject } from "@/lib/email/branding";
import { normaliseSiteName } from "@/lib/site-brand";

describe("site brand (R8-11)", () => {
  it("normalises blank / non-string names to the default", () => {
    expect(normaliseSiteName("  Acme Studio ")).toBe("Acme Studio");
    expect(normaliseSiteName("   ")).toBe("CodeKraft");
    expect(normaliseSiteName(null)).toBe("CodeKraft");
  });

  it("rebrands email subjects and the From display name", () => {
    expect(brandSubject("Verify your CodeKraft email", "Acme")).toBe("Verify your Acme email");
    expect(brandSubject("Verify your CodeKraft email", "CodeKraft")).toBe(
      "Verify your CodeKraft email",
    );
    expect(brandFromAddress("CodeKraft <hi@x.dev>", "Acme Studio")).toBe("Acme Studio <hi@x.dev>");
    expect(brandFromAddress("hi@x.dev", "Acme")).toBe("hi@x.dev");
    expect(brandFromAddress("CodeKraft <hi@x.dev>", 'Evil"<x>')).toBe("Evilx <hi@x.dev>");
  });

  it("header wordmark and inline name follow the provider", () => {
    render(
      <SiteBrandProvider siteName="Acme Studio">
        <Wordmark />
        <p data-testid="inline">
          <SiteName prefix="Welcome to " />
        </p>
      </SiteBrandProvider>,
    );
    expect(screen.getAllByText("Acme Studio").length).toBeGreaterThan(0);
    expect(screen.getByTestId("inline")).toHaveTextContent("Welcome to Acme Studio");
  });
});
