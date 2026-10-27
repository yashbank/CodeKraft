import { describe, expect, it } from "vitest";

process.env.APP_ENCRYPTION_KEY ??= "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
import { encrypt } from "@/lib/crypto";
import { generateLicenseKey, maskLicenseKey } from "@/modules/delivery/handlers/license";

describe("R8-03 licence keys", () => {
  it("generates unique CK-XXXX-XXXX-XXXX-XXXX keys without ambiguous characters", () => {
    const a = generateLicenseKey();
    expect(a).toMatch(/^CK(-[2-9A-HJKMNP-Z]{4}){4}$/);
    expect(generateLicenseKey()).not.toBe(a);
  });

  it("masks with the real last 4 characters, never a fixed placeholder", () => {
    expect(maskLicenseKey(encrypt("CK-AAAA-BBBB-CCCC-9F2Q"))).toBe("•••• •••• •••• 9F2Q");
    expect(maskLicenseKey("not-a-token")).toBeNull();
  });
});
