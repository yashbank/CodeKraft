import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateKey } from "@/lib/crypto";
import { razorpaySettingsSchema } from "@/modules/settings/contracts";
import {
  decryptRazorpaySecret,
  encryptRazorpaySecret,
  getSettingsEncryptionKey,
  maskRazorpaySettings,
} from "@/modules/settings/service";
import type { RazorpaySettings } from "@/modules/settings/types";

describe("razorpaySettingsSchema", () => {
  it("accepts a valid test-mode config", () => {
    const parsed = razorpaySettingsSchema.parse({
      mode: "test",
      keyId: "rzp_test_abc123",
      keySecret: "shh",
      webhookSecret: "whsec",
    });
    expect(parsed.mode).toBe("test");
  });

  it("accepts all-null secrets (not yet configured)", () => {
    const parsed = razorpaySettingsSchema.parse({
      mode: "test",
      keyId: null,
      keySecret: null,
      webhookSecret: null,
    });
    expect(parsed.keyId).toBeNull();
  });

  it("rejects an invalid mode", () => {
    expect(() =>
      razorpaySettingsSchema.parse({
        mode: "sandbox",
        keyId: null,
        keySecret: null,
        webhookSecret: null,
      }),
    ).toThrow();
  });

  it("rejects unknown fields (strict object)", () => {
    expect(() =>
      razorpaySettingsSchema.parse({
        mode: "test",
        keyId: null,
        keySecret: null,
        webhookSecret: null,
        extra: "nope",
      }),
    ).toThrow();
  });
});

describe("maskRazorpaySettings", () => {
  it("masks keySecret and webhookSecret to last 4, leaves mode/keyId untouched", () => {
    const rp: RazorpaySettings = {
      mode: "test",
      keyId: "rzp_test_abc123",
      keySecret: "supersecretvalue1234",
      webhookSecret: "whsec_abcdefgh",
    };
    const masked = maskRazorpaySettings(rp);

    expect(masked.mode).toBe("test");
    expect(masked.keyId).toBe("rzp_test_abc123");
    expect(masked.keySecret).toBe("****************1234");
    expect(masked.webhookSecret).toBe("**********efgh");
    expect(masked.keySecret).not.toContain("supersecret");
    expect(masked.webhookSecret).not.toContain("whsec_abcd");
  });

  it("passes through null secrets unchanged", () => {
    const rp: RazorpaySettings = {
      mode: "test",
      keyId: "kid",
      keySecret: null,
      webhookSecret: null,
    };
    const masked = maskRazorpaySettings(rp);
    expect(masked.keySecret).toBeNull();
    expect(masked.webhookSecret).toBeNull();
  });
});

describe("Razorpay secret encryption (SETTINGS_ENCRYPTION_KEY, separate from APP_ENCRYPTION_KEY)", () => {
  const original = process.env.SETTINGS_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.SETTINGS_ENCRYPTION_KEY = generateKey();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
    else process.env.SETTINGS_ENCRYPTION_KEY = original;
  });

  it("round-trips a secret through encrypt/decrypt", () => {
    const token = encryptRazorpaySecret("my-razorpay-key-secret");
    expect(token).not.toContain("my-razorpay-key-secret");
    expect(decryptRazorpaySecret(token)).toBe("my-razorpay-key-secret");
  });

  it("falls back to null for a tampered/malformed token rather than throwing", () => {
    expect(decryptRazorpaySecret("v1:not:a:valid:token")).toBeNull();
  });

  it("throws a clear AppError (not a crash at import/env-parse time) when the key is unset", () => {
    delete process.env.SETTINGS_ENCRYPTION_KEY;
    expect(() => getSettingsEncryptionKey()).toThrow(/SETTINGS_ENCRYPTION_KEY/);
    expect(() => encryptRazorpaySecret("x")).toThrow(/SETTINGS_ENCRYPTION_KEY/);
  });

  it("never includes the raw secret value in the thrown error's message", () => {
    const token = encryptRazorpaySecret("super-sensitive-value");
    delete process.env.SETTINGS_ENCRYPTION_KEY;
    try {
      decryptRazorpaySecret(token);
      throw new Error("expected decryptRazorpaySecret to throw");
    } catch (err) {
      expect(String((err as Error).message)).not.toContain("super-sensitive-value");
    }
  });
});
