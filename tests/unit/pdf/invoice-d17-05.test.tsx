// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceDocument, type InvoiceProps } from "@/pdf/Invoice";
import { CreditNoteDocument } from "@/pdf/CreditNote";
import { buildInvoicePdf } from "@/modules/invoices/pdf";
import { buildSellerSnapshot } from "@/modules/invoices/service";

const line = (i: number, description = `Item ${i}`) => ({
  description,
  quantity: 1,
  unit_minor: 10000,
  discount_minor: 0,
  tax_minor: 1800,
  total_minor: 11800,
});
const base = (lines = [line(1)]): InvoiceProps => ({
  invoiceNo: "CK/26-27/0001",
  issuedAt: "2026-04-10",
  seller: { name: "Crestline", address: "1 Rd, Pune", gst_number: "27AAAAA0000A1Z5" },
  buyer: { name: "A", email: "a@x.test", country: "US" },
  lines,
  subtotalMinor: 10000 * lines.length,
  discountMinor: 0,
  taxMinor: 1800 * lines.length,
  totalMinor: 11800 * lines.length,
  currency: "USD",
});
const pdfText = (b: Buffer) => b.toString("latin1");

describe("D17-05 invoice output", () => {
  it("states the charged currency in HTML and PDF", () => {
    expect(renderToStaticMarkup(<InvoiceDocument {...base()} />)).toContain("Currency: USD");
    expect(pdfText(buildInvoicePdf(base()))).toContain("All amounts in USD");
  });

  it("print rule reaches th and span descendants of accent blocks and outranks the global rule", () => {
    const html = renderToStaticMarkup(<InvoiceDocument {...base()} />);
    const print = /@media print\{(.*)\}\n\.ck-lines tbody/s.exec(html)?.[1] ?? "";
    const rule = /([^{}]*\.ck-on-accent \*)\{color:#fff!important\}/.exec(print)?.[1] ?? "";
    expect(rule).toContain(".ck-invoice .ck-on-accent *"); // 2 classes beats globals.css [data-app] :where(..) = 1 attr
    const classes = (sel: string) => (sel.match(/\.[\w-]+/g) ?? []).length;
    expect(classes(".ck-invoice .ck-on-accent *")).toBeGreaterThan(1);
    expect(html).toMatch(/<tr class="ck-on-accent"[^>]*><th/); // head cells are descendants
    expect(html).toMatch(/<div class="ck-on-accent"[^>]*><span>Grand Total:<\/span><span>/);
    expect(html.match(/class="ck-on-accent"/g)?.length).toBe(3);
  });

  it("credit note names the currency", () => {
    const html = renderToStaticMarkup(
      <CreditNoteDocument
        creditNo="CN1"
        invoiceNo="I1"
        issuedAt="2026-04-10"
        seller={base().seller}
        buyer={base().buyer}
        amountMinor={500}
        currency="USD"
      />,
    );
    expect(html).toContain("Credit Amount (USD):");
  });

  it("long names and 60 lines paginate; every row and the grand total are present", () => {
    const long = "Enterprise ".repeat(40) + "X".repeat(120);
    const lines = Array.from({ length: 60 }, (_, i) => line(i + 1, i === 3 ? long : undefined));
    const out = pdfText(buildInvoicePdf(base(lines)));
    expect(out).toMatch(/\/Count (\d+)/);
    expect(Number(/\/Count (\d+)/.exec(out)?.[1])).toBeGreaterThan(1);
    expect(out).toContain("Item 60");
    expect(out).toContain("Grand Total:");
    expect(out).toContain("USD 7,080.00"); // 60 * 118.00, exact minor-unit sum
  });

  it("new seller snapshot keeps address line2, state and phone", () => {
    const s = buildSellerSnapshot({
      sellerDetails: {
        name: "Crestline",
        address: {
          line1: "1 Rd",
          line2: "Floor 2",
          city: "Pune",
          state: "MH",
          postalCode: "411001",
          country: "IN",
        },
        contactPhones: ["+91 1", "+91 2"],
        email: "b@c.test",
      },
      siteName: "Crestline",
      gstin: "27AAAAA0000A1Z5",
      siteLogo: null,
    } as never);
    expect(s.address).toBe("1 Rd, Floor 2, Pune, MH, 411001");
    expect(s.phone).toBe("+91 1, +91 2");
  });
});
