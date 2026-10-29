// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveSeller } from "@/modules/invoices/service";
import { buildInvoicePdf } from "@/modules/invoices/pdf";
import { SITE_SETTINGS_DEFAULTS } from "@/modules/settings/contracts";
import type { InvoiceProps } from "@/pdf/Invoice";

const stored = {
  name: "Old Name",
  address: "1 Old Rd, Pune, 411001",
  gst_number: "27AAAAA0000A1Z5",
  email: "old@x.com",
  state_code: "MH",
  logo_url: "https://cdn.example/old.png",
};
const settings = (over: object) => ({ ...SITE_SETTINGS_DEFAULTS, ...over });
const renamed = { siteName: "New Brand", siteLogo: "https://cdn.example/new.png" };

describe("R9-02 invoices follow current settings", () => {
  it("ON: an invoice issued before a rename shows the new name and logo, keeps state code", () => {
    const s = resolveSeller(stored, settings({ ...renamed, refreshOldInvoices: true }));
    expect(s.name).toBe("New Brand");
    expect(s.logo_url).toBe("https://cdn.example/new.png");
    expect(s.state_code).toBe("MH");
    expect(s.address).toBe(stored.address); // no current seller details set: keep stored
  });
  it("OFF: keeps the stored snapshot", () => {
    expect(resolveSeller(stored, settings({ ...renamed, refreshOldInvoices: false }))).toBe(stored);
  });
  it("defaults to ON", () => {
    expect(SITE_SETTINGS_DEFAULTS.refreshOldInvoices).toBe(true);
  });
});

describe("R9-02 PDF totals layout", () => {
  const inv = {
    invoiceNo: "CK/1",
    issuedAt: "2026-01-01",
    seller: stored,
    buyer: { name: "A", email: "a@x.com", country: "IN" },
    lines: [],
    subtotalMinor: 10000,
    discountMinor: 1000,
    taxMinor: 0,
    totalMinor: 9000,
    currency: "INR",
  } as unknown as InvoiceProps;

  it("Grand Total box sits below the Discount row (no overlap)", () => {
    const pdf = buildInvoicePdf(inv).toString("latin1");
    const dy = Number(/([\d.]+) Td \(Discount:\)/.exec(pdf)?.[1]);
    const box = /340 ([\d.-]+) 215 24 re f/.exec(pdf);
    const boxTop = Number(box?.[1]) + 24;
    expect(dy).toBeGreaterThan(0);
    expect(boxTop).toBeLessThan(dy - 2); // text baseline clears the box top
  });
});
