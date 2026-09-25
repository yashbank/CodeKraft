import { describe, expect, it } from "vitest";
import { gstinSchema, upiVpaSchema, updateSettingsSchema } from "@/modules/settings/contracts";

describe("settings schemas & validation (PHASE-03 P3.3, API-ADM-10)", () => {
  describe("gstinSchema", () => {
    it("accepts valid 15-character uppercase Indian GSTINs", () => {
      expect(gstinSchema.parse("27AAAAA0000A1Z5")).toBe("27AAAAA0000A1Z5");
      expect(gstinSchema.parse("07AABCS1429B1ZB")).toBe("07AABCS1429B1ZB");
    });

    it("automatically normalizes lowercase to uppercase", () => {
      expect(gstinSchema.parse("27aaaaa0000a1z5")).toBe("27AAAAA0000A1Z5");
    });

    it("rejects strings shorter or longer than 15 characters", () => {
      expect(() => gstinSchema.parse("27AAAAA0000A1Z")).toThrow();
      expect(() => gstinSchema.parse("27AAAAA0000A1Z59")).toThrow();
    });

    it("rejects special characters", () => {
      expect(() => gstinSchema.parse("27AAAAA0000A1Z-")).toThrow();
      expect(() => gstinSchema.parse("27AAAAA0000A1Z#")).toThrow();
    });
  });

  describe("upiVpaSchema", () => {
    it("accepts valid UPI VPAs", () => {
      expect(upiVpaSchema.parse("merchant@okaxis")).toBe("merchant@okaxis");
      expect(upiVpaSchema.parse("codekraft.store@icici")).toBe("codekraft.store@icici");
      expect(upiVpaSchema.parse("team-pay@upi")).toBe("team-pay@upi");
    });

    it("rejects invalid UPI VPAs", () => {
      expect(() => upiVpaSchema.parse("plainstring")).toThrow();
      expect(() => upiVpaSchema.parse("@handle")).toThrow();
      expect(() => upiVpaSchema.parse("user@")).toThrow();
    });
  });

  describe("updateSettingsSchema", () => {
    it("rejects empty patch", () => {
      expect(() => updateSettingsSchema.parse({ patch: {} })).toThrow(/at least one field/i);
    });

    it("rejects when enabledCurrencies excludes baseCurrency", () => {
      expect(() =>
        updateSettingsSchema.parse({
          patch: {
            baseCurrency: "USD",
            enabledCurrencies: ["INR", "EUR"],
          },
        }),
      ).toThrow(/enabledCurrencies must include baseCurrency/i);
    });

    it("accepts valid partial patch", () => {
      const parsed = updateSettingsSchema.parse({
        patch: {
          taxRateBps: 1800,
          gstin: "27AAAAA0000A1Z5",
          defaultTheme: "dark-cinematic",
        },
      });
      expect(parsed.patch.taxRateBps).toBe(1800);
      expect(parsed.patch.gstin).toBe("27AAAAA0000A1Z5");
    });
  });
});
