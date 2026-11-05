// @vitest-environment node
/** Every outbox template name written in src is registered, and renders from the real payload shape. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/settings/service", () => ({
  settingsService: { load: async () => ({ siteName: "Acme" }) },
}));

import { EMAIL_TEMPLATES, renderEmailTemplate } from "@/emails";
import { resetEmailThemeCache } from "@/lib/email/theme";

const SRC = path.resolve(import.meta.dirname, "../../../src");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = path.join(d, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

// Written to the outbox but intentionally rendered by the generic layout (url / code / message body).
const GENERIC_OK = new Set([
  "change-email",
  "phone-otp",
  "admin-invite",
  "test-email",
  "delivery-saas-credentials",
]);

describe("outbox template names", () => {
  it("every name written in src is registered (or deliberately generic)", () => {
    const names = new Set<string>();
    for (const f of walk(SRC)) {
      if (f.includes(`${path.sep}emails${path.sep}`)) continue;
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\b(?:template|emailTemplate):\s*"([a-z0-9-]+)"/g))
        names.add(m[1]!);
    }
    expect(names.size).toBeGreaterThan(8);
    const missing = [...names].filter((n) => !EMAIL_TEMPLATES[n] && !GENERIC_OK.has(n));
    expect(missing).toEqual([]);
  });
});

const SITE = "https://shop.acme.test";
const ORDER = { orderId: "o1", orderNo: "ORD-2026-0001" };
// Exact shapes written by each site (old = before D17-06 added fields; must still render).
const CASES: Array<[string, Record<string, unknown>, string[]]> = [
  [
    "invoice",
    {
      invoiceId: "i1",
      invoiceNo: "INV-9",
      orderNo: ORDER.orderNo,
      total: "1500.00",
      currency: "INR",
    },
    ["INV-9", "₹1,500.00", "/account/invoices"],
  ],
  [
    "invoice",
    {
      invoiceId: "i1",
      invoiceNo: "INV-9",
      orderNo: ORDER.orderNo,
      total: "1500.00",
      currency: "INR",
      url: "/account/invoices/i1",
    },
    [`${SITE}/account/invoices/i1`],
  ],
  [
    "order-created",
    { ...ORDER, name: "Ann", offeringName: "Pro", amount: "999.00" },
    ["ORD-2026-0001", "Pro", "/account/orders"],
  ],
  [
    "order-created",
    {
      ...ORDER,
      name: "Ann",
      offeringName: "Pro",
      amount: "999.00",
      currency: "INR",
      url: "/account/orders/o1",
    },
    ["₹999.00", `${SITE}/account/orders/o1`],
  ],
  ["order-expired", { ...ORDER, name: "Ann" }, ["ORD-2026-0001", `${SITE}/products`]],
  ["payment-failed", { ...ORDER, reason: "bank declined" }, ["ORD-2026-0001", "try again"]],
  [
    "payment-failed",
    { ...ORDER, reason: "x", url: "/account/orders/o1" },
    [`${SITE}/account/orders/o1`],
  ],
  ["payment-confirmed", { ...ORDER, amountPaid: "999.00", currency: "INR" }, ["ORD-2026-0001"]],
  [
    "refund-issued",
    { ...ORDER, refundId: "r1", amountMinor: 250000, currency: "INR", creditNo: "CN-7" },
    ["CN-7", "₹2,500.00"],
  ],
  ["refund-issued", { creditNoteNumber: "CN-8", amountMinor: 100, currency: "INR" }, ["CN-8"]],
  ["query-reply", { queryId: "q1", subject: "Help" }, [`${SITE}/account/queries/q1`]],
  [
    "custom-quote",
    {
      quoteId: "q",
      title: "Site",
      amount: "1500.00",
      currency: "INR",
      validUntil: null,
      resend: false,
      payUrl: "https://shop.acme.test/quote/t",
    },
    ["Site", "₹1,500.00"],
  ],
];

describe("render from real payload shapes", () => {
  beforeEach(resetEmailThemeCache);
  it.each(CASES)("%s", async (name, data, expects) => {
    const tpl = EMAIL_TEMPLATES[name]!;
    const subject = tpl.subject(data);
    expect(subject.length).toBeGreaterThan(4);
    const { html, text } = await renderEmailTemplate(name, data, SITE);
    for (const out of [subject, html, text]) expect(out).not.toMatch(/undefined|NaN|\[object/);
    expect(subject).not.toMatch(/#$/);
    for (const e of expects) expect(html + subject).toContain(e);
  });
});
