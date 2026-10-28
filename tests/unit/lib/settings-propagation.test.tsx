// @vitest-environment node
/** P4-02 — admin Settings values reach seller snapshots, email footer and feature flags. */
import { describe, expect, it } from "vitest";
import { contactFromSeller } from "@/lib/site-brand";
import { buildSellerSnapshot } from "@/modules/invoices/service";
import { renderGenericEmail } from "@/lib/email/render";
import { clearFlagCache, getFlag, setFlagLoader } from "@/lib/feature-flags";

const base = { siteName: "Acme", gstin: "29ABCDE1234F1Z5", sellerDetails: null };

describe("settings propagation (P4-02)", () => {
  it("new invoice seller snapshot follows current settings", () => {
    const before = buildSellerSnapshot(base, "MH");
    expect(before).toMatchObject({ name: "Acme", gst_number: base.gstin, state_code: "MH" });
    const after = buildSellerSnapshot(
      {
        ...base,
        sellerDetails: {
          name: "Acme Pvt Ltd",
          address: { line1: "1 Rd", city: "Pune", postalCode: "411001", country: "IN" },
          contactPhones: [],
          email: "bill@acme.test",
        },
      },
      null,
    );
    expect(after).toMatchObject({
      name: "Acme Pvt Ltd",
      address: "1 Rd, Pune, 411001",
      email: "bill@acme.test",
    });
    expect(before.name).toBe("Acme"); // issued snapshot is a stored value, never recomputed
  });

  it("email footer shows the configured site name", async () => {
    const { html } = await renderGenericEmail("Hi", {}, "https://acme.test", "Acme");
    expect(html).toContain("Acme");
    expect(html).not.toContain("CodeKraft");
  });

  it("a flag switched off in settings reads false", async () => {
    setFlagLoader(async () => false);
    clearFlagCache();
    expect(await getFlag("provider_razorpay")).toBe(false);
    setFlagLoader(undefined);
  });
});

describe("settings propagation: fallbacks and footer (P4-02b)", () => {
  it("empty seller details never invent an address or email", () => {
    const s = buildSellerSnapshot(base, null);
    expect(s.address).toBe("Address not set");
    expect(s.email).toBe("");
  });

  it("footer contact comes from settings, null when unset", () => {
    expect(contactFromSeller(null)).toEqual({
      legalName: null,
      address: null,
      email: null,
      phones: null,
    });
    expect(
      contactFromSeller({
        name: "Acme Pvt Ltd",
        email: "hi@acme.test",
        contactPhones: ["+911", "+912"],
        address: { line1: "1 Rd", city: "Pune", postalCode: "411001" },
      }),
    ).toEqual({
      legalName: "Acme Pvt Ltd",
      address: "1 Rd, Pune, 411001",
      email: "hi@acme.test",
      phones: "+911, +912",
    });
  });

  it("footer renders the contact block", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { SiteFooter } = await import("@/components/site/SiteFooter");
    const html = renderToStaticMarkup(
      createElement(SiteFooter, {
        contact: { legalName: "Acme Pvt Ltd", address: null, email: "hi@acme.test", phones: null },
      }),
    );
    expect(html).toContain("Acme Pvt Ltd");
    expect(html).toContain("hi@acme.test");
  });
});
