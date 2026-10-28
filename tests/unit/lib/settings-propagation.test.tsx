// @vitest-environment node
/** P4-02 — admin Settings values reach seller snapshots, email footer and feature flags. */
import { describe, expect, it } from "vitest";
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
