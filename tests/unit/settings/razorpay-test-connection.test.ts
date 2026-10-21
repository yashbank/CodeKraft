import { afterEach, describe, expect, it, vi } from "vitest";

const { loadMock } = vi.hoisted(() => ({ loadMock: vi.fn() }));
vi.mock("@/modules/settings/service", () => ({
  settingsService: { load: loadMock },
}));

import {
  resetTestConnectionDeps,
  runRazorpayTestConnection,
  setTestConnectionDeps,
} from "@/modules/settings/razorpay-test-connection-core";

describe("runRazorpayTestConnection (admin Settings > Payments > Test connection, D-501, TEST MODE ONLY)", () => {
  afterEach(() => {
    resetTestConnectionDeps();
    loadMock.mockReset();
  });

  it("throws a clear, non-leaking error when no keys are saved yet", async () => {
    loadMock.mockResolvedValue({ razorpaySettings: null });
    await expect(runRazorpayTestConnection()).rejects.toThrow(/Save a Key ID/);
  });

  it("uses the currently PERSISTED keys, not any not-yet-saved value, and succeeds on a real order.create", async () => {
    loadMock.mockResolvedValue({
      razorpaySettings: {
        mode: "test",
        keyId: "rzp_test_persisted",
        keySecret: "persisted_secret",
        webhookSecret: null,
      },
    });
    const create = vi.fn().mockResolvedValue({ id: "order_abc" });
    const createClient = vi.fn().mockReturnValue({ orders: { create } });
    setTestConnectionDeps({ createClient });

    await expect(runRazorpayTestConnection()).resolves.toBeUndefined();

    expect(createClient).toHaveBeenCalledWith("rzp_test_persisted", "persisted_secret");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ amount: 100, currency: "INR" }));
  });

  it("wraps any SDK failure in a generic message — the raw error never reaches the caller", async () => {
    loadMock.mockResolvedValue({
      razorpaySettings: {
        mode: "test",
        keyId: "rzp_test_bad",
        keySecret: "wrong_secret",
        webhookSecret: null,
      },
    });
    setTestConnectionDeps({
      createClient: () => ({
        orders: {
          create: () =>
            Promise.reject(new Error("401 Unauthorized: key_id=rzp_test_bad secret=wrong_secret")),
        },
      }),
    });

    let caught: unknown;
    try {
      await runRazorpayTestConnection();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toMatch(/^Connection failed/);
    expect(message).not.toContain("wrong_secret");
    expect(message).not.toContain("Unauthorized");
  });
});
