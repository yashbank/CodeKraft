import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  CURRENCIES,
  add,
  allocateLargestRemainder,
  assertCurrency,
  assertMinor,
  assertMoney,
  compare,
  convertMinor,
  divRoundHalfUp,
  equals,
  format,
  isCurrency,
  isNegative,
  isZero,
  money,
  mulBps,
  neg,
  parseDecimalScaled,
  parseMinor,
  sub,
  toDecimalString,
  toInrMinor,
  toSafeNumber,
  zero,
  type Money,
} from "@/lib/money";

const inr = (amountMinor: number): Money => money(amountMinor, "INR");
const usd = (amountMinor: number): Money => money(amountMinor, "USD");

describe("money constructors and guards", () => {
  it("accepts the five supported currencies and rejects others", () => {
    for (const c of CURRENCIES) expect(isCurrency(c)).toBe(true);
    expect(isCurrency("JPY")).toBe(false);
    expect(isCurrency(42)).toBe(false);
    expect(assertCurrency("INR")).toBe("INR");
    expect(() => assertCurrency("JPY")).toThrow(TypeError);
    expect(() => money(1, "JPY" as never)).toThrow(/unsupported currency/);
  });

  it("requires safe integers for minor amounts", () => {
    expect(assertMinor(5)).toBe(5);
    expect(() => assertMinor(1.5)).toThrow(/safe integer/);
    expect(() => assertMinor(Number.NaN, "x")).toThrow(/^x must be/);
    expect(() => money(2 ** 53, "INR")).toThrow(TypeError);
    expect(assertMoney({ amountMinor: 3, currency: "USD" })).toEqual(usd(3));
  });

  it("narrows bigint to a safe number or throws", () => {
    expect(toSafeNumber(12n)).toBe(12);
    expect(() => toSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
    expect(() => toSafeNumber(BigInt(Number.MIN_SAFE_INTEGER) - 1n, "q")).toThrow(/^q is below/);
  });

  it("zero / isZero / isNegative", () => {
    expect(zero("EUR")).toEqual({ amountMinor: 0, currency: "EUR" });
    expect(isZero(zero("EUR"))).toBe(true);
    expect(isZero(inr(1))).toBe(false);
    expect(isNegative(inr(-1))).toBe(true);
    expect(isNegative(inr(0))).toBe(false);
  });
});

describe("add / sub / neg", () => {
  it("adds and subtracts in the same currency", () => {
    expect(add(inr(100), inr(250))).toEqual(inr(350));
    expect(sub(inr(100), inr(250))).toEqual(inr(-150));
    expect(neg(inr(5))).toEqual(inr(-5));
    expect(neg(inr(-5))).toEqual(inr(5));
  });

  it("refuses currency mismatches and overflow", () => {
    expect(() => add(inr(1), usd(1))).toThrow(/currency mismatch/);
    expect(() => sub(inr(1), usd(1))).toThrow(/currency mismatch/);
    expect(() => add(inr(Number.MAX_SAFE_INTEGER), inr(1))).toThrow(/sum exceeds/);
    expect(() => sub(inr(Number.MIN_SAFE_INTEGER), inr(1))).toThrow(/difference is below/);
  });
});

describe("compare / equals", () => {
  it("orders amounts", () => {
    expect(compare(inr(1), inr(2))).toBe(-1);
    expect(compare(inr(2), inr(1))).toBe(1);
    expect(compare(inr(2), inr(2))).toBe(0);
    expect(equals(inr(2), inr(2))).toBe(true);
    expect(equals(inr(2), inr(3))).toBe(false);
    expect(() => compare(inr(1), usd(1))).toThrow(/currency mismatch/);
  });
});

describe("divRoundHalfUp", () => {
  it("rounds half away from zero", () => {
    expect(divRoundHalfUp(5n, 2n)).toBe(3n);
    expect(divRoundHalfUp(-5n, 2n)).toBe(-3n);
    expect(divRoundHalfUp(5n, -2n)).toBe(-3n);
    expect(divRoundHalfUp(-5n, -2n)).toBe(3n);
    expect(divRoundHalfUp(4n, 3n)).toBe(1n);
    expect(divRoundHalfUp(7n, 3n)).toBe(2n);
    expect(divRoundHalfUp(0n, 3n)).toBe(0n);
    expect(() => divRoundHalfUp(1n, 0n)).toThrow(/division by zero/);
  });
});

describe("mulBps", () => {
  it("applies basis points with half-up rounding", () => {
    expect(mulBps(inr(10_000), 1800)).toEqual(inr(1800)); // 18 % GST of ₹100
    expect(mulBps(inr(5), 5000)).toEqual(inr(3)); // 2.5 → 3
    expect(mulBps(inr(-5), 5000)).toEqual(inr(-3)); // -2.5 → -3
    expect(mulBps(inr(1000), -1000)).toEqual(inr(-100)); // discount
    expect(mulBps(inr(999), 3333)).toEqual(inr(333)); // 332.9667 → 333
    expect(mulBps(inr(1), 1)).toEqual(inr(0)); // 0.0001 → 0
  });

  it("validates bps and overflow", () => {
    expect(() => mulBps(inr(1), 1.5)).toThrow(/bps must be/);
    expect(() => mulBps(inr(Number.MAX_SAFE_INTEGER), 20_000)).toThrow(/mulBps result exceeds/);
  });
});

describe("allocateLargestRemainder", () => {
  it("splits exactly with leftover units going to the largest remainders", () => {
    expect(allocateLargestRemainder(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateLargestRemainder(100, [5000, 5000])).toEqual([50, 50]);
    expect(allocateLargestRemainder(101, [5000, 5000])).toEqual([51, 50]);
    expect(allocateLargestRemainder(10, [1, 2, 3])).toEqual([2, 3, 5]);
    expect(allocateLargestRemainder(0, [1, 2])).toEqual([0, 0]);
    expect(allocateLargestRemainder(7, [0, 1])).toEqual([0, 7]);
  });

  it("breaks remainder ties by larger weight then lower index", () => {
    // 5 across weights [1, 3]: ideals 1.25 / 3.75 → [1, 4]
    expect(allocateLargestRemainder(5, [1, 3])).toEqual([1, 4]);
    // 1 across equal weights: same remainder, same weight → lowest index wins
    expect(allocateLargestRemainder(1, [1, 1, 1])).toEqual([1, 0, 0]);
    // 3 across [1, 1, 2]: ideals .75 / .75 / 1.5 → remainders 3,3,2 (of 4) → [1, 1, 1]
    expect(allocateLargestRemainder(3, [1, 1, 2])).toEqual([1, 1, 1]);
    // 2 across [2, 1, 1]: remainders 0, 2, 2 (of 4), tie on weight → index → [1, 1, 0]
    expect(allocateLargestRemainder(2, [2, 1, 1])).toEqual([1, 1, 0]);
    // remainder tie broken by the larger weight: 5 across [3, 1, 4] (sum 8):
    // scaled 15, 5, 20 → floors 1, 0, 2 (rem 7, 5, 4) → leftover 2 → [2, 1, 2]
    expect(allocateLargestRemainder(5, [3, 1, 4])).toEqual([2, 1, 2]);
    // equal remainders, different weights: 6 across [1, 3] (sum 4): scaled 6, 18 → rem 2, 2 →
    // the heavier weight gets the unit → [1, 5]
    expect(allocateLargestRemainder(6, [1, 3])).toEqual([1, 5]);
  });

  it("allocates negative totals on the absolute value and negates", () => {
    expect(allocateLargestRemainder(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });

  it("rejects invalid input", () => {
    expect(() => allocateLargestRemainder(100, [])).toThrow(/at least one weight/);
    expect(() => allocateLargestRemainder(100, [1, -1])).toThrow(/non-negative integers/);
    expect(() => allocateLargestRemainder(100, [1.5])).toThrow(/non-negative integers/);
    expect(() => allocateLargestRemainder(100, [0, 0])).toThrow(/not all be zero/);
    expect(() => allocateLargestRemainder(1.5, [1])).toThrow(/totalMinor must be/);
  });

  it("property: sums to total and every part is within one minor unit of its ideal share", () => {
    const weights = fc
      .array(fc.integer({ min: 0, max: 10_000 }), { minLength: 1, maxLength: 8 })
      .filter((ws) => ws.some((w) => w > 0));
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 }),
        weights,
        (total, ws) => {
          const parts = allocateLargestRemainder(total, ws);
          expect(parts).toHaveLength(ws.length);
          const sum = parts.reduce((a, b) => a + b, 0);
          expect(sum).toBe(total);
          const weightSum = ws.reduce((a, b) => BigInt(a) + BigInt(b), 0n);
          parts.forEach((part, i) => {
            expect(Number.isSafeInteger(part)).toBe(true);
            // |part − total·w/Σw| < 1  ⇔  |part·Σw − total·w| < Σw
            const diff = BigInt(part) * weightSum - BigInt(total) * BigInt(ws[i] as number);
            const abs = diff < 0n ? -diff : diff;
            expect(abs < weightSum).toBe(true);
            if (total >= 0) expect(part).toBeGreaterThanOrEqual(0);
            else expect(part).toBeLessThanOrEqual(0);
          });
        },
      ),
      { numRuns: process.env.CI ? 2000 : 500 },
    );
  });

  it("property: allocation is deterministic and order-consistent", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 8 }),
        (total, ws) => {
          expect(allocateLargestRemainder(total, ws)).toEqual(allocateLargestRemainder(total, ws));
          expect(allocateLargestRemainder(-total, ws)).toEqual(
            allocateLargestRemainder(total, ws).map((p) => 0 - p),
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("parseDecimalScaled / convertMinor / toInrMinor", () => {
  it("parses decimal strings exactly", () => {
    expect(parseDecimalScaled("83.5", 8)).toBe(8_350_000_000n);
    expect(parseDecimalScaled("0.01200000", 8)).toBe(1_200_000n);
    expect(parseDecimalScaled("83", 8)).toBe(8_300_000_000n);
    expect(parseDecimalScaled("83.", 2)).toBe(8300n);
    expect(parseDecimalScaled(" +1.5 ", 1)).toBe(15n);
    expect(parseDecimalScaled("7", 0)).toBe(7n);
  });

  it("rejects malformed or over-precise input", () => {
    expect(() => parseDecimalScaled("-1", 2)).toThrow(/invalid decimal string/);
    expect(() => parseDecimalScaled("1e5", 2)).toThrow(/invalid decimal string/);
    expect(() => parseDecimalScaled("1.234", 2)).toThrow(/more than 2 fraction digits/);
    expect(() => parseDecimalScaled("1", 1.5)).toThrow(/scale must be/);
  });

  it("converts by an 8-decimal rate with half-up rounding", () => {
    expect(convertMinor(10_000, "83.50000000")).toBe(835_000); // $100 → ₹8 350
    expect(convertMinor(1, "0.01200000")).toBe(0); // 0.012 → 0
    expect(convertMinor(50, "0.01200000")).toBe(1); // 0.6 → 1
    expect(convertMinor(-125, "0.5")).toBe(-63); // -62.5 → -63
    expect(toInrMinor(10_000, "83.5")).toBe(835_000);
    expect(() => convertMinor(1.5, "1")).toThrow(TypeError);
    expect(() => convertMinor(Number.MAX_SAFE_INTEGER, "2")).toThrow(/converted amount exceeds/);
  });
});

describe("toDecimalString / format", () => {
  it("renders minor units as a decimal string", () => {
    expect(toDecimalString(123456)).toBe("1234.56");
    expect(toDecimalString(5)).toBe("0.05");
    expect(toDecimalString(-5)).toBe("-0.05");
    expect(toDecimalString(0)).toBe("0.00");
    expect(toDecimalString(100)).toBe("1.00");
    expect(() => toDecimalString(0.5)).toThrow(TypeError);
  });

  it("formats INR with lakh grouping and other currencies with their locale", () => {
    expect(format(inr(12_345_678))).toBe("₹1,23,456.78");
    expect(format(inr(-12_345_678))).toBe("-₹1,23,456.78");
    expect(format(inr(1_00_00_00_000))).toBe("₹1,00,00,000.00"); // one crore
    expect(format(inr(5))).toBe("₹0.05");
    expect(format(usd(123_456))).toBe("$1,234.56");
    expect(format(money(123_456, "EUR"))).toBe("€1,234.56");
    expect(format(money(123_456, "GBP"))).toBe("£1,234.56");
    expect(format(money(123_456, "CAD"))).toBe("$1,234.56");
  });

  it("honours an explicit locale", () => {
    expect(format(inr(12_345_678), "en-US")).toBe("₹123,456.78");
    expect(format(usd(123_456), "en-IN")).toBe("$1,234.56");
  });
});

describe("parseMinor", () => {
  it("parses user input without floats", () => {
    expect(parseMinor("1,23,456.78", "INR")).toBe(12_345_678);
    expect(parseMinor("₹ 1,234.50", "INR")).toBe(123_450);
    expect(parseMinor("INR 1234", "INR")).toBe(123_400);
    expect(parseMinor("US$1,234.5", "USD")).toBe(123_450);
    expect(parseMinor("CA$ 2", "CAD")).toBe(200);
    expect(parseMinor("-12", "INR")).toBe(-1200);
    expect(parseMinor("+12", "INR")).toBe(1200);
    expect(parseMinor(".5", "INR")).toBe(50);
    expect(parseMinor("5.", "INR")).toBe(500);
    expect(parseMinor("0.07", "EUR")).toBe(7);
    expect(parseMinor("€0.07", "EUR")).toBe(7);
    expect(parseMinor("£0.07", "GBP")).toBe(7);
  });

  it("rejects garbage, too many decimals, empty input and unknown currencies", () => {
    expect(() => parseMinor("abc", "INR")).toThrow(/invalid amount/);
    expect(() => parseMinor("1.234", "INR")).toThrow(/invalid amount/);
    expect(() => parseMinor("", "INR")).toThrow(/invalid amount/);
    expect(() => parseMinor("₹", "INR")).toThrow(/invalid amount/);
    expect(() => parseMinor(".", "INR")).toThrow(/invalid amount/);
    expect(() => parseMinor("1", "JPY" as never)).toThrow(/unsupported currency/);
    expect(() => parseMinor("99999999999999999", "INR")).toThrow(/parsed amount exceeds/);
  });

  it("round-trips toDecimalString and format", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 }), (minor) => {
        expect(parseMinor(toDecimalString(minor), "INR")).toBe(minor);
        expect(parseMinor(format(inr(minor)), "INR")).toBe(minor);
        expect(parseMinor(format(usd(minor)), "USD")).toBe(minor);
      }),
      { numRuns: 300 },
    );
  });
});
