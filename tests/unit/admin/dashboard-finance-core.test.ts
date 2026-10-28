import { describe, expect, it } from "vitest";
import { buildMyShare } from "@/lib/admin/dashboard-finance-core";
import { EMPTY_RAW_SUMS, deriveMetrics } from "@/modules/finance/metrics-core";

describe("dashboard My share", () => {
  const raw = { ...EMPTY_RAW_SUMS, partnerAllocation: 50_000, refundPartnerAllocation: 5_000 };

  it("equals the finance partner-shares metric for the same ledger sums", () => {
    expect(buildMyShare(raw, [0, 20_000, 25_000]).valueInr).toBe(
      deriveMetrics(raw).partnerSharesMinor,
    );
    expect(buildMyShare(raw, []).valueInr).toBe(45_000);
  });

  it("is the admin's own share, not the all-partner or company total", () => {
    const total = { ...raw, partnerAllocation: 200_000, companyCut: 100_000 };
    const mine = buildMyShare(raw, []).valueInr;
    expect(mine).not.toBe(deriveMetrics(total).partnerSharesMinor);
    expect(mine).toBe(45_000);
  });

  it("reports an empty period", () => {
    expect(buildMyShare(EMPTY_RAW_SUMS, []).valueInr).toBe(0);
  });
});
