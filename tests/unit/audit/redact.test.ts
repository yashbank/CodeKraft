import { describe, expect, it } from "vitest";
import { REDACTED_PLACEHOLDER, redactSensitive } from "@/modules/audit/redact";

describe("audit redactSensitive (docs/10 §7, PHASE-03 P3.1)", () => {
  it("redacts required credential and secret fields as [redacted]", () => {
    const input = {
      id: "usr_1",
      email: "test@example.com",
      password: "SuperSecretPassword123!",
      token: "secret-token-xyz",
      license_key_enc: "enc:raw-license-key",
      payout_bank_details_enc: "enc:bank-account-456",
      apiKey: "sk-proj-123456",
    };

    const redacted = redactSensitive(input);

    expect(redacted.id).toBe("usr_1");
    expect(redacted.email).toBe("test@example.com");
    expect(redacted.password).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.token).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.license_key_enc).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.payout_bank_details_enc).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.apiKey).toBe(REDACTED_PLACEHOLDER);
  });

  it("redacts nested objects and arrays recursively", () => {
    const input = {
      user: {
        profile: {
          password: "my-password",
        },
        tokens: [{ token: "tok-1" }, { token: "tok-2" }],
      },
    };

    const redacted = redactSensitive(input);

    expect(redacted.user.profile.password).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.user.tokens[0]?.token).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.user.tokens[1]?.token).toBe(REDACTED_PLACEHOLDER);
  });

  it("leaves non-sensitive fields untouched", () => {
    const input = {
      title: "My Product",
      price: 4999,
      tags: ["dev", "saas"],
      active: true,
    };

    expect(redactSensitive(input)).toEqual(input);
  });
});
