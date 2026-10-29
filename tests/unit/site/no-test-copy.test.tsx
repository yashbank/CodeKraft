import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/modules/leads/site-actions", () => ({ submitLead: vi.fn() }));

import { InquiryForm } from "@/components/site/InquiryForm";

const BAD = /testing only|for testing|tester|test only|test mode|beta tester/i;

describe("no test/tester copy in user-facing UI (P8-03)", () => {
  it.each(["idle", "success", "error", "turnstile_down"] as const)(
    "InquiryForm (%s) renders no test copy",
    (initialStatus) => {
      const { container } = render(
        <InquiryForm serviceOptions={[]} variant="full" initialStatus={initialStatus} />,
      );
      expect(container.textContent).not.toMatch(BAD);
    },
  );

  it("customer checkout Razorpay hint has no test-mode copy", () => {
    const src = readFileSync("src/components/account/CheckoutScreen.tsx", "utf8");
    const hint = /hint: "(Pay instantly[^"]*)"/.exec(src)?.[1] ?? "";
    expect(hint).not.toBe("");
    expect(hint).not.toMatch(BAD);
  });
});
