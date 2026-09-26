import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatementDocument } from "@/pdf/Statement";

describe("StatementDocument PDF Component", () => {
  const baseProps = {
    partnerName: "Acme Agency",
    dateFrom: "2026-04-01",
    dateTo: "2026-04-30",
    openingBalanceMinor: 10000,
    closingBalanceMinor: 25000,
    currency: "INR",
    lines: [
      {
        date: "2026-04-15",
        type: "payout",
        description: "Revenue share for Order #100",
        amountMinor: 15000,
      },
    ],
  };

  it("renders partner statement header, balances, and line items", () => {
    const html = renderToStaticMarkup(<StatementDocument {...baseProps} />);

    expect(html).toContain("PARTNER STATEMENT");
    expect(html).toContain("Acme Agency");
    expect(html).toContain("100.00");
    expect(html).toContain("250.00");
    expect(html).toContain("Revenue share for Order #100");
    expect(html).toContain("150.00");
  });
});
