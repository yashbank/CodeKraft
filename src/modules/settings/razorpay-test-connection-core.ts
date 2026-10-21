/**
 * Core logic for the admin "Test connection" check (V1.1, D-501, TEST MODE ONLY) — kept out of
 * `razorpay-test-connection.ts` because a `"use server"` file may only export async functions;
 * the injectable `deps` seam (for unit tests) and the plain `TestConnectionDeps` object/type
 * can't live there.
 *
 * Creates a throwaway Razorpay order (100 paise, never persisted) using the currently PERSISTED
 * `razorpaySettings.keyId`/`keySecret` — never the admin's not-yet-saved form values — to prove
 * the keys actually authenticate. Any SDK failure is wrapped in a generic message: Razorpay SDK
 * errors can embed request/account details that must never reach the browser.
 */
import Razorpay from "razorpay";
import { AppError, ErrorCode } from "@/lib/errors";
import { settingsService } from "./service";

/** Thin surface so tests can stub the SDK without a real network call (mirrors `RazorpayClient`). */
export interface TestConnectionDeps {
  createClient(
    keyId: string,
    keySecret: string,
  ): { orders: { create: (p: unknown) => Promise<unknown> } };
}

export const defaultTestConnectionDeps: TestConnectionDeps = {
  createClient(keyId, keySecret) {
    return new Razorpay({ key_id: keyId, key_secret: keySecret }) as unknown as {
      orders: { create: (p: unknown) => Promise<unknown> };
    };
  },
};

let deps = defaultTestConnectionDeps;

/** Test-only seam — production always uses `defaultTestConnectionDeps`. */
export function setTestConnectionDeps(next: TestConnectionDeps): void {
  deps = next;
}

export function resetTestConnectionDeps(): void {
  deps = defaultTestConnectionDeps;
}

export async function runRazorpayTestConnection(): Promise<void> {
  const settings = await settingsService.load();
  const rp = settings.razorpaySettings;
  if (!rp?.keyId || !rp?.keySecret) {
    throw new AppError(
      ErrorCode.STATE_INVALID,
      "Save a Key ID and Key Secret before testing the connection",
    );
  }

  try {
    const client = deps.createClient(rp.keyId, rp.keySecret);
    await client.orders.create({
      amount: 100,
      currency: "INR",
      receipt: `settings_test_${Date.now()}`,
    });
  } catch {
    // Never forward the raw SDK error — it can embed request ids / account details.
    throw new AppError(
      ErrorCode.UPSTREAM_UNAVAILABLE,
      "Connection failed: Razorpay rejected the test request — check the Key ID/Secret and mode",
    );
  }
}
