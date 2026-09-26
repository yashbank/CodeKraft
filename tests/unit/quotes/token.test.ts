import { describe, expect, it } from "vitest";
import { generateQuoteToken } from "@/modules/quotes/token";
import { zQuoteToken } from "@/modules/quotes/types";

describe("Custom Quote Token unit tests (D-520, TM-11)", () => {
  it("generates a valid token satisfying zQuoteToken with >= 128 bits entropy", () => {
    const token = generateQuoteToken();

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThanOrEqual(24);
    expect(zQuoteToken.safeParse(token).success).toBe(true);
  });

  it("produces unique cryptographically random tokens across multiple calls", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateQuoteToken());
    }

    expect(tokens.size).toBe(100);
  });
});
