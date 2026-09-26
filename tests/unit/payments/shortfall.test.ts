import { describe, expect, it } from "vitest";
import { computeManualConfirmAmounts } from "@/modules/payments/provider";

describe("Shortfall calculation unit tests", () => {
  it("calculates positive shortfall when received < due", () => {
    const due = 100000;
    const received = 97500;
    const res = computeManualConfirmAmounts(due, received);

    expect(res.amountReceivedMinor).toBe(97500);
    expect(res.bankShortfallMinor).toBe(2500);
    expect(res.customerCreditMinor).toBe(0);
  });

  it("yields zero shortfall when received == due", () => {
    const due = 50000;
    const received = 50000;
    const res = computeManualConfirmAmounts(due, received);

    expect(res.amountReceivedMinor).toBe(50000);
    expect(res.bankShortfallMinor).toBe(0);
    expect(res.customerCreditMinor).toBe(0);
  });
});
