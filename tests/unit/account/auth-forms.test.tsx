import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const signInEmailMock = vi.fn();

vi.mock("@/modules/auth/client", () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => signInEmailMock(...args), social: vi.fn() },
  },
}));

import { LoginForm } from "@/components/account/LoginForm";
import { RegisterScreen } from "@/components/account/RegisterScreen";
import {
  ProductFilters,
  EMPTY_FILTERS,
  type ProductFilterState,
} from "@/components/site/ProductFilters";

afterEach(() => {
  cleanup();
  signInEmailMock.mockReset();
});

describe("LoginForm validation (BUG-022)", () => {
  it("shows a custom error summary on empty submit instead of relying on the native bubble", () => {
    render(<LoginForm designed />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Please fix the following:")).toBeTruthy();
    expect(screen.getAllByText("Enter your email").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Enter your password").length).toBeGreaterThan(0);
    expect(signInEmailMock).not.toHaveBeenCalled();
  });
});

describe("LoginForm admin branding (BUG-020)", () => {
  it("drops the customer-only Google button, remember-device checkbox and sign-up link on the admin host", () => {
    render(<LoginForm designed host="admin" />);

    expect(screen.queryByRole("button", { name: /continue with google/i })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /remember this device/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /create an account/i })).toBeNull();
    expect(screen.getByRole("link", { name: /forgot password/i })).toBeTruthy();
  });

  it("keeps the customer visuals on the site host", () => {
    render(<LoginForm designed host="site" />);

    expect(screen.getByRole("button", { name: /continue with google/i })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /remember this device/i })).toBeTruthy();
  });
});

describe("RegisterScreen (BUG-023)", () => {
  it("explains why Create account is disabled beyond the checklist once a weak password is typed", () => {
    const { container } = render(<RegisterScreen />);
    const passwordInput = container.querySelector("#reg-password") as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: "weak" } });

    const button = screen.getByRole("button", { name: "Create account" });
    expect(button).toBeDisabled();
    expect(
      screen.getByText("Finish the password requirements above to create your account."),
    ).toBeTruthy();
  });
});

describe("ProductFilters ids (BUG-024)", () => {
  it("scopes checkbox ids per instance so two simultaneous renders never collide", () => {
    const categories = [{ slug: "saas", name: "SaaS", children: [] }];
    const props = {
      value: EMPTY_FILTERS as ProductFilterState,
      onChange: vi.fn(),
      categories,
      techOptions: [],
      industryOptions: [],
      audienceOptions: [],
    };

    render(
      <>
        <ProductFilters {...props} />
        <ProductFilters {...props} />
      </>,
    );

    const boxes = screen.getAllByRole("checkbox", { name: "SaaS" });
    expect(boxes).toHaveLength(2);
    expect(boxes[0]?.id).not.toBe(boxes[1]?.id);
  });
});
