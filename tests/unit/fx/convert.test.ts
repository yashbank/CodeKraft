import { describe, expect, it } from "vitest";
import { format8Decimals, invertRate, to8DecimalString } from "@/modules/fx/client";
import { convertMinor, money } from "@/lib/money";
import { DefaultFxService } from "@/modules/fx/service";

describe("FX Mathematical Conversions & Rounding (PHASE-03 P3.12, D-515)", () => {
  it("to8DecimalString formats without floating-point artifacts", () => {
    expect(to8DecimalString("0.012")).toBe("0.01200000");
    expect(to8DecimalString("83.5")).toBe("83.50000000");
    expect(to8DecimalString(0.01198)).toBe("0.01198000");
    expect(to8DecimalString(1)).toBe("1.00000000");
  });

  it("format8Decimals handles various scales correctly", () => {
    expect(format8Decimals(1200000n)).toBe("0.01200000");
    expect(format8Decimals(50000000n)).toBe("0.50000000");
    expect(format8Decimals(8350000000n)).toBe("83.50000000");
  });

  it("invertRate computes exact 8-decimal inverse via bigint without floats", () => {
    // 1 / 2.0 = 0.5
    expect(invertRate("2.00000000")).toBe("0.50000000");

    // 1 / 0.5 = 2.0
    expect(invertRate("0.50000000")).toBe("2.00000000");

    // 1 / 0.012 = 83.33333333
    expect(invertRate("0.01200000")).toBe("83.33333333");

    // 1 / 83.33333333 = 0.01200000
    expect(invertRate("83.33333333")).toBe("0.01200000");
  });

  it("convertMinor performs financial round-half-up on minor integer units", () => {
    // 10000 paise (₹100) * 0.012 USD/INR = 120 cents ($1.20)
    expect(convertMinor(10000, "0.01200000")).toBe(120);

    // Rounding half-up:
    // 100 paise * 0.01250000 = 1.25 cents -> 1 cent
    expect(convertMinor(100, "0.01250000")).toBe(1);

    // 150 paise * 0.01000000 = 1.5 cents -> 2 cents (half up)
    expect(convertMinor(150, "0.01000000")).toBe(2);
  });

  it("convertDisplay returns approx: true for cross-currency, approx: false for same currency", async () => {
    const service = new DefaultFxService();

    // Same currency: approx is false
    const inr = money(50000, "INR");
    const same = await service.convertDisplay(inr, "INR");
    expect(same.approx).toBe(false);
    expect(same.money.amountMinor).toBe(50000);
    expect(same.rate).toBe("1.00000000");

    // Cross currency: uses static table fallback when db is empty
    const cross = await service.convertDisplay(inr, "USD");
    expect(cross.approx).toBe(true);
    expect(cross.money.currency).toBe("USD");
    // 50000 paise (₹500) * 0.012 = 600 cents ($6.00)
    expect(cross.money.amountMinor).toBe(600);
    expect(cross.rate).toBe("0.01200000");
  });
});
