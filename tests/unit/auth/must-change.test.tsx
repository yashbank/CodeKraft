import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT:${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@/modules/auth/invite-actions", () => ({
  acceptLink: vi.fn(),
  changeTemporaryPassword: vi.fn(),
}));

import { SetPasswordScreen } from "@/components/account/SetPasswordScreen";
import { enforcePasswordChange } from "@/lib/authz/must-change";

describe("forced password change guard", () => {
  it("redirects to the change-password page until the flag is cleared", () => {
    expect(() => enforcePasswordChange({ user: { mustChangePassword: true } })).toThrow(
      "REDIRECT:/auth/change-password",
    );
    expect(() => enforcePasswordChange({ user: { mustChangePassword: false } })).not.toThrow();
    expect(() => enforcePasswordChange({ user: {} })).not.toThrow();
  });
});

describe("SetPasswordScreen", () => {
  it.each([
    ["expired", /expired/],
    ["used", /already used or has been replaced/],
    ["invalid", /isn't valid/],
  ] as const)("shows a friendly page for a %s link", (reason, text) => {
    render(<SetPasswordScreen mode={{ kind: "invalid", reason }} />);
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeTruthy();
  });

  it("asks for the temporary password on forced change", () => {
    render(<SetPasswordScreen mode={{ kind: "change" }} />);
    expect(screen.getByLabelText(/temporary password/i)).toBeTruthy();
  });
});
