// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const load = vi.fn();
vi.mock("@/modules/settings/service", () => ({ settingsService: { load } }));

import { EMAIL_TEMPLATES, renderEmailTemplate } from "@/emails";
import { EMAIL_PREVIEW_DATA } from "@/lib/email/preview-data";
import { loadEmailTheme, readableOn, resetEmailThemeCache } from "@/lib/email/theme";
import { renderGenericEmail } from "@/lib/email/render";

const SITE = "https://shop.acme.test";
const settings = { siteName: "Acme", siteLogo: "https://cdn.acme.test/l.png", palette: "emerald" };

beforeEach(() => {
  resetEmailThemeCache();
  load.mockReset();
  load.mockResolvedValue(settings);
});

describe("every registered template", () => {
  it("has preview data and renders in the shared themed layout", async () => {
    for (const name of Object.keys(EMAIL_TEMPLATES)) {
      expect(EMAIL_PREVIEW_DATA[name], name).toBeDefined();
      const { html, text } = await renderEmailTemplate(name, EMAIL_PREVIEW_DATA[name]!, SITE);
      expect(html, name).toContain("ek-card");
      expect(html, name).toContain("color-scheme");
      expect(html, name).toContain("https://cdn.acme.test/l.png");
      expect(html, name).not.toMatch(/oklch|var\(--/);
      expect(text.length, name).toBeGreaterThan(10);
      // every href is absolute
      for (const m of html.matchAll(/href="([^"]*)"/g)) expect(m[1], name).toMatch(/^https?:/);
    }
  });

  it("keeps reset/verify links unchanged and resolves relative ones on the site URL", async () => {
    const r = await renderEmailTemplate(
      "reset-password",
      { url: "https://x.test/auth/reset?t=a&b=1" },
      SITE,
    );
    expect(r.html).toContain('href="https://x.test/auth/reset?t=a&amp;b=1"');
    const q = await renderEmailTemplate("query-reply", { subject: "S" }, SITE);
    expect(q.html).toContain(`href="${SITE}/account/queries"`);
  });

  it("keeps quote money and subjects", async () => {
    const d = EMAIL_PREVIEW_DATA["custom-quote"]!;
    const { html } = await renderEmailTemplate("custom-quote", d, SITE);
    expect(html).toContain("1,500.00");
    expect(html).toContain("valid until 2030-01-31");
    expect(EMAIL_TEMPLATES["custom-quote"]!.subject(d)).toContain("Your quote: Sample quote");
  });
});

describe("theme", () => {
  it("uses the palette accent and a readable button text colour", async () => {
    const { html } = await renderEmailTemplate("verify-email", { url: "https://x.test/v" }, SITE);
    expect(html).toContain("#0a7a4b");
    expect(html).toContain("color:#FFFFFF");
    expect(readableOn("#e8c547")).toBe("#000000");
    expect(readableOn("#3f35d6")).toBe("#FFFFFF");
  });

  it("falls back to defaults when settings cannot be read, and still renders", async () => {
    load.mockRejectedValue(new Error("db down"));
    const { html } = await renderEmailTemplate("verify-email", { url: "https://x.test/v" }, SITE);
    expect(html).toContain("#3f35d6");
    expect(html).toContain("CodeKraft");
    expect(html).not.toContain("<img");
  });

  it("reads settings once for a batch, and a failure is cached briefly", async () => {
    await Promise.all([loadEmailTheme(), loadEmailTheme(), loadEmailTheme()]);
    expect(load).toHaveBeenCalledTimes(1);
    resetEmailThemeCache();
    load.mockRejectedValue(new Error("down"));
    await loadEmailTheme();
    await loadEmailTheme();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("drops an SVG logo for the text wordmark", async () => {
    load.mockResolvedValue({ ...settings, siteLogo: "https://cdn.acme.test/l.svg" });
    const { html } = await renderEmailTemplate("payment-confirmed", { orderNo: "A1" }, SITE);
    expect(html).not.toContain("<img");
    expect(html).toContain("Acme");
  });
});

describe("generic fallback layout", () => {
  it("uses the same layout for unregistered templates", async () => {
    const { html } = await renderGenericEmail("Hi", { url: "/go" }, SITE);
    expect(html).toContain("ek-card");
    expect(html).toContain(`href="${SITE}/go"`);
  });
});
