import { describe, expect, it } from "vitest";
import { computeManualConfirmAmounts } from "@/modules/payments/provider";

describe("Overpayment calculation unit tests", () => {
  it("calculates customer credit when received > due", () => {
    const due = 100000;
    const received = 101000;
    const res = computeManualConfirmAmounts(due, received);

    expect(res.amountReceivedMinor).toBe(101000);
    expect(res.bankShortfallMinor).toBe(0);
    expect(res.customerCreditMinor).toBe(1000);
  });

  it("yields zero customer credit when received <= due", () => {
    const due = 100000;
    const received = 100000;
    const res = computeManualConfirmAmounts(due, received);

    expect(res.customerCreditMinor).toBe(0);
  });
});
