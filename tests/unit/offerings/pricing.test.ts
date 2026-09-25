import { describe, expect, it } from "vitest";
import { formatOfferingPrice, resolveOfferingPrice } from "@/modules/offerings/pricing";
import type { OfferingPrice } from "@/modules/offerings/types";

describe("offerings pricing resolution (D-502, D-515, PHASE-03 P3.7)", () => {
  const dummyPrices: OfferingPrice[] = [
    {
      offeringId: "offering-1",
      currency: "INR",
      amountMinor: 835000, // ₹8,350.00
      compareAtMinor: 1000000, // ₹10,000.00
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      offeringId: "offering-1",
      currency: "EUR",
      amountMinor: 9500, // €95.00
      compareAtMinor: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it("returns explicit price when available for the requested display currency", async () => {
    const res = await resolveOfferingPrice(dummyPrices, "EUR");
    expect(res).not.toBeNull();
    expect(res?.currency).toBe("EUR");
    expect(res?.amountMinor).toBe(9500);
    expect(res?.compareAtMinor).toBeNull();
    expect(res?.explicit).toBe(true);
    expect(formatOfferingPrice(res!)).toBe("€95.00");
  });

  it("falls back to INR base price converted via FX provider with explicit: false", async () => {
    // USD rate from static table: INR/USD = 0.01200000
    // 835000 * 0.01200000 = 10020 cents ($100.20)
    const res = await resolveOfferingPrice(dummyPrices, "USD");
    expect(res).not.toBeNull();
    expect(res?.currency).toBe("USD");
    expect(res?.amountMinor).toBe(10020);
    expect(res?.compareAtMinor).toBe(12000); // 1000000 * 0.012 = 12000 cents ($120.00)
    expect(res?.explicit).toBe(false);
    expect(formatOfferingPrice(res!)).toBe("$100.20");
  });

  it("returns null when price list is empty", async () => {
    const res = await resolveOfferingPrice([], "USD");
    expect(res).toBeNull();
  });
});
