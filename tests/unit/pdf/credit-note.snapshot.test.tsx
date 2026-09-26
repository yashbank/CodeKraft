import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CreditNoteDocument } from "@/pdf/CreditNote";

describe("CreditNoteDocument PDF Component", () => {
  const baseProps = {
    creditNo: "CK/CN/26-27/0001",
    invoiceNo: "CK/26-27/0001",
    issuedAt: "2026-04-12",
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
    },
    amountMinor: 5000,
    currency: "INR",
  };

  it("renders credit note header, invoice reference, and amount", () => {
    const html = renderToStaticMarkup(<CreditNoteDocument {...baseProps} />);

    expect(html).toContain("CREDIT NOTE");
    expect(html).toContain("CK/CN/26-27/0001");
    expect(html).toContain("CK/26-27/0001");
    expect(html).toContain("50.00");
  });
});
