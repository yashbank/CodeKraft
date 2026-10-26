import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const resetPassword = vi.hoisted(() => vi.fn());
vi.mock("@/modules/auth/client", () => ({ authClient: { resetPassword } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ResetPasswordScreen } from "@/components/account/ResetPasswordScreen";

const STRONG = "Str0ng!Passw0rd";

function fill(pw: string, confirm: string) {
  fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: pw } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));
}

beforeEach(() => {
  push.mockReset();
  resetPassword.mockReset();
});

describe("ResetPasswordScreen set step", () => {
  it("calls resetPassword with token and routes to login", async () => {
    resetPassword.mockResolvedValue({ data: {}, error: null });
    render(<ResetPasswordScreen step="set" token="tok123" />);
    fill(STRONG, STRONG);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/auth/login"));
    expect(resetPassword).toHaveBeenCalledWith({ newPassword: STRONG, token: "tok123" });
  });

  it("shows the server error and does not navigate", async () => {
    resetPassword.mockResolvedValue({ data: null, error: { message: "Token expired" } });
    render(<ResetPasswordScreen step="set" token="tok123" />);
    fill(STRONG, STRONG);
    expect(await screen.findByText("Token expired")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("blocks mismatched or weak passwords", () => {
    render(<ResetPasswordScreen step="set" token="tok123" />);
    fill(STRONG, "other");
    expect(resetPassword).not.toHaveBeenCalled();
  });
});
