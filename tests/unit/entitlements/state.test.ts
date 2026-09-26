import { describe, expect, it } from "vitest";
import {
  canTransitionEntitlement,
  assertValidEntitlementTransition,
} from "@/modules/entitlements/state";
import { AppError } from "@/lib/errors";

describe("Entitlements State Machine (docs/03 §3.4, MASTER_SPEC §7)", () => {
  it("allows valid transitions", () => {
    // pending -> active, revoked
    expect(canTransitionEntitlement("pending", "active")).toBe(true);
    expect(canTransitionEntitlement("pending", "revoked")).toBe(true);
    expect(canTransitionEntitlement("pending", "pending")).toBe(true);

    // active -> suspended, expired, revoked
    expect(canTransitionEntitlement("active", "suspended")).toBe(true);
    expect(canTransitionEntitlement("active", "expired")).toBe(true);
    expect(canTransitionEntitlement("active", "revoked")).toBe(true);

    // suspended -> active, revoked
    expect(canTransitionEntitlement("suspended", "active")).toBe(true);
    expect(canTransitionEntitlement("suspended", "revoked")).toBe(true);

    // expired -> revoked
    expect(canTransitionEntitlement("expired", "revoked")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionEntitlement("pending", "suspended")).toBe(false);
    expect(canTransitionEntitlement("pending", "expired")).toBe(false);
    expect(canTransitionEntitlement("expired", "active")).toBe(false);
    expect(canTransitionEntitlement("revoked", "active")).toBe(false);
    expect(canTransitionEntitlement("revoked", "pending")).toBe(false);

    expect(() => assertValidEntitlementTransition("revoked", "active")).toThrow(AppError);
  });
});
