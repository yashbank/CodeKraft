// @vitest-environment node
/** P6-02 — admin-uploaded site logo with a neutral text-wordmark fallback. */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteBrandProvider } from "@/components/brand/site-brand";
import { Wordmark } from "@/components/site/Wordmark";
import { renderGenericEmail } from "@/lib/email/render";
import { buildSellerSnapshot } from "@/modules/invoices/service";
import { DefaultSettingsService } from "@/modules/settings/service";

const LOGO = "https://cdn.acme.test/logo.png";
const mark = (logo: string | null) =>
  renderToStaticMarkup(
    <SiteBrandProvider siteName="Acme" siteLogo={logo}>
      <Wordmark />
    </SiteBrandProvider>,
  );

describe("getSiteLogo", () => {
  it("returns the set URL, else null", async () => {
    vi.resetModules();
    const load = vi
      .fn()
      .mockResolvedValueOnce({ siteLogo: LOGO })
      .mockResolvedValueOnce({ siteLogo: null });
    vi.doMock("@/modules/settings/service", () => ({ settingsService: { load } }));
    const { getSiteLogo } = await import("@/lib/site-brand");
    expect(await getSiteLogo()).toBe(LOGO);
    expect(await getSiteLogo()).toBeNull();
    vi.doUnmock("@/modules/settings/service");
  });
});

describe("logo rendering", () => {
  it("header/footer wordmark shows the logo when set, the site name when not", () => {
    expect(mark(LOGO)).toContain(`src="${LOGO}"`);
    const none = mark(null);
    expect(none).toContain("Acme");
    expect(none).not.toContain("<img");
    expect(none).not.toContain("CodeKraft");
  });

  it("email header shows the logo when set, the site name when not", async () => {
    const withLogo = await renderGenericEmail("Hi", {}, "https://acme.test", "Acme", LOGO);
    expect(withLogo.html).toContain(LOGO);
    const without = await renderGenericEmail("Hi", {}, "https://acme.test", "Acme", null);
    expect(without.html).not.toContain("<img");
    expect(without.html).toContain("Acme");
    expect(without.html).not.toContain("wordmark-mono");
  });
});

describe("invoice snapshot and permissions", () => {
  const base = { siteName: "Acme", gstin: null, sellerDetails: null };
  it("a new snapshot carries the logo; an earlier snapshot object is unchanged", () => {
    const old = buildSellerSnapshot({ ...base, siteLogo: null });
    const fresh = buildSellerSnapshot({ ...base, siteLogo: LOGO });
    expect(fresh.logo_url).toBe(LOGO);
    expect(old.logo_url).toBeNull();
  });

  it("a caller without settings.write cannot set the logo", async () => {
    const ctx = { userId: "u", roles: ["admin"], permissions: new Set(["settings.read"]) };
    await expect(
      new DefaultSettingsService().updateSettings(ctx as never, { patch: { siteLogo: LOGO } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
