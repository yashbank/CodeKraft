import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SiteBrandProvider } from "@/components/brand/site-brand";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { LaptopNotice } from "@/components/admin/LaptopNotice";
import { AuthLayout } from "@/components/account/AuthLayout";
import { Wordmark as SiteWordmark } from "@/components/site/Wordmark";
import { EmailLayout } from "@/lib/email/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/site-brand", async (orig) => ({
  ...(await orig<typeof import("@/lib/site-brand")>()),
  getSiteLogo: async () => "https://cdn.test/logo.png",
  getSiteName: async () => "Acme",
}));

vi.mock("@/lib/fonts", () => ({ fontVariables: "" }));
afterEach(cleanup);
const LOGO = "https://cdn.test/logo.png";
const wrap = (n: React.ReactNode) => (
  <SiteBrandProvider siteName="Acme" siteLogo={LOGO}>
    {n}
  </SiteBrandProvider>
);

describe("configured logo reaches every surface", () => {
  it("site header/footer wordmark", () => {
    const { container } = render(wrap(<SiteWordmark />));
    expect(container.querySelector(`img[src="${LOGO}"]`)).not.toBeNull();
  });
  it("auth pages", () => {
    const { container } = render(wrap(<AuthLayout>x</AuthLayout>));
    expect(container.querySelector(`img[src="${LOGO}"]`)).not.toBeNull();
  });
  it("admin login (no CK monogram)", () => {
    const { container } = render(wrap(<AdminLogin environment="production" />));
    expect(container.querySelector(`img[src="${LOGO}"]`)).not.toBeNull();
    expect(container.textContent).not.toMatch(/\bCK\b/);
  });
  it("admin LaptopNotice", () => {
    const { container } = render(
      wrap(<LaptopNotice title="T" approvalsHref="/a" notificationsHref="/n" />),
    );
    expect(container.querySelector(`img[src="${LOGO}"]`)).not.toBeNull();
  });
  it("email layout, and the EMAIL_TEMPLATES render path", async () => {
    const html = renderToStaticMarkup(
      <EmailLayout preview="p" title="t" siteUrl="https://x.y" siteName="Acme" logoUrl={LOGO}>
        b
      </EmailLayout>,
    );
    expect(html).toContain(LOGO);
    const { EMAIL_TEMPLATES } = await import("@/emails");
    // The template path now reads the theme from settings (D17-06), not site-brand.
    const { buildEmailTheme } = await import("@/lib/email/theme");
    const theme = buildEmailTheme({ siteName: "Acme", siteLogo: LOGO });
    const out = await EMAIL_TEMPLATES["verify-email"]!.render(
      { url: "https://x" },
      "https://x.y",
      theme,
    );
    expect(out.html).toContain(LOGO);
    expect(out.html).toContain("Verify your Acme email address");
  });
  it("settings logo reaches a rendered template email (no injected theme)", async () => {
    vi.resetModules();
    vi.doMock("@/modules/settings/service", () => ({
      settingsService: { load: async () => ({ siteName: "Acme", siteLogo: LOGO }) },
    }));
    const { renderEmailTemplate } = await import("@/emails");
    const out = await renderEmailTemplate("payment-confirmed", { orderNo: "A1" }, "https://x.y");
    vi.doUnmock("@/modules/settings/service");
    expect(out.html).toContain(`src="${LOGO}"`);
  });
  it("metadata icons, apple icon and openGraph/twitter images", async () => {
    const { generateMetadata } = await import("@/app/layout");
    const m = await generateMetadata();
    expect(m.icons).toMatchObject({ icon: LOGO, apple: LOGO });
    expect(m.openGraph?.images).toEqual([LOGO]);
    expect(m.twitter?.images).toEqual([LOGO]);
  });
});
