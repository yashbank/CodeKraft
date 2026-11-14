import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/modules/leads/site-actions", () => ({ submitLead: vi.fn() }));
vi.mock("@/lib/form-guard-action", () => ({ issueFormGuardToken: vi.fn(async () => "t") }));

import { InquiryForm } from "@/components/site/InquiryForm";

describe("inquiry form hidden bot protection", () => {
  it("renders a hidden, aria-hidden, untabbable, no-autocomplete honeypot and no captcha", () => {
    const { container } = render(<InquiryForm serviceOptions={[]} variant="full" />);
    const hp = container.querySelector<HTMLInputElement>('input[name="website_url"]');
    expect(hp).not.toBeNull();
    expect(hp?.tabIndex).toBe(-1);
    expect(hp?.getAttribute("autocomplete")).toBe("off");
    expect(hp?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector('[data-slot="turnstile-widget"]')).toBeNull();
    expect(container.textContent).not.toMatch(/cloudflare|turnstile|automated spam/i);
  });

  it("no source file still loads the Cloudflare challenge script or requires a token", () => {
    for (const f of [
      "src/components/site/InquiryForm.tsx",
      "src/components/site/submit-inquiry.ts",
      "src/components/account/RegisterScreen.tsx",
      "src/middleware.ts",
    ]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/challenges\.cloudflare\.com|TurnstileWidget/);
    }
  });
});
