import { describe, expect, it } from "vitest";

import { PASSWORD_MIN, PASSWORD_MIN_ADMIN, validatePassword } from "@/modules/auth/password-policy";

describe("password policy (docs/09 §3.2)", () => {
  it("rejects short passwords, longer minimum for admins", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN - 1))).toBe("too_short");
    expect(validatePassword("a".repeat(PASSWORD_MIN))).toBeNull();
    expect(validatePassword("a".repeat(PASSWORD_MIN), { isAdmin: true })).toBe("too_short");
    expect(validatePassword("a".repeat(PASSWORD_MIN_ADMIN), { isAdmin: true })).toBeNull();
  });
  it("rejects the email local part inside the password", () => {
    expect(validatePassword("Pravin-secret-2026", { email: "pravin@iauro.com" })).toBe(
      "contains_email",
    );
    expect(validatePassword("totally-unrelated-42", { email: "pravin@iauro.com" })).toBeNull();
  });
  it("rejects blank and over-long", () => {
    expect(validatePassword("            ")).toBe("whitespace_only");
    expect(validatePassword("x".repeat(129))).toBe("too_long");
  });
});
