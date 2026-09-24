/** Harness smoke test: fast-check runs inside the `unit` project (docs/10 §5 arbitraries come in P3). */
import { describe, expect, it } from "vitest";
import fc from "fast-check";

describe("property harness", () => {
  it("integer addition is commutative and keeps minor units integral", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
        expect(Number.isInteger(a + b)).toBe(true);
      }),
      { numRuns: process.env.CI ? 500 : 100 },
    );
  });
});
