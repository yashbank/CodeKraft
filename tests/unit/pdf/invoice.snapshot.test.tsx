import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceDocument } from "@/pdf/Invoice";

describe("InvoiceDocument PDF Component (D-1502, BR-08)", () => {
  const baseProps = {
    invoiceNo: "CK/26-27/0001",
    issuedAt: "2026-04-10",
    seller: {
      name: "CodeKraft Inc",
      address: "123 Tech Park, Bengaluru, KA 560001",
      email: "billing@codekraft.dev",
      gst_number: "29AAAAA0000A1Z5",
      state_code: "KA",
    },
    buyer: {
      name: "Alice Smith",
      email: "alice@example.com",
      country: "IN",
      company: "Acme Corp",
      address: "456 Market St, Bengaluru, KA",
      gst_number: "29BBBBB1111B1Z2",
      state_code: "KA",
    },
    lines: [
      {
        description: "Template: Next.js SaaS Starter",
        quantity: 1,
        unit_minor: 10000,
        discount_minor: 1000,
        tax_minor: 1620,
        total_minor: 10620,
      },
    ],
    subtotalMinor: 10000,
    discountMinor: 1000,
    taxMinor: 1620,
    totalMinor: 10620,
    currency: "INR",
  };

  it("renders invoice metadata and lines correctly", () => {
    const html = renderToStaticMarkup(<InvoiceDocument {...baseProps} />);

    expect(html).toContain("TAX INVOICE");
    expect(html).toContain("CK/26-27/0001");
    expect(html).toContain("CodeKraft Inc");
    expect(html).toContain("Alice Smith");
    expect(html).toContain("Template: Next.js SaaS Starter");
    expect(html).toContain("100.00"); // 10000 / 100
  });

  it("renders GST breakdown when present", () => {
    const html = renderToStaticMarkup(
      <InvoiceDocument
        {...baseProps}
        gstBreakdown={{
          cgst_minor: 810,
          sgst_minor: 810,
          rate_bps: 1800,
        }}
      />
    );

    expect(html).toContain("CGST:");
    expect(html).toContain("SGST:");
    expect(html).toContain("8.10");
  });

  it("omits GST breakdown when absent", () => {
    const html = renderToStaticMarkup(
      <InvoiceDocument {...baseProps} gstBreakdown={null} />
    );

    expect(html).not.toContain("CGST:");
    expect(html).not.toContain("SGST:");
    expect(html).not.toContain("IGST:");
  });
});
