import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const createLeadAction = vi.hoisted(() => vi.fn());
vi.mock("@/modules/leads/site-actions", () => ({ submitLead: createLeadAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const requestPasswordReset = vi.hoisted(() => vi.fn());
vi.mock("@/modules/auth/client", () => ({ authClient: { requestPasswordReset } }));

import { InquiryForm } from "@/components/site/InquiryForm";
import { submitInquiry } from "@/components/site/submit-inquiry";
import { ResetPasswordScreen } from "@/components/account/ResetPasswordScreen";

const values = {
  name: "Ada",
  email: "ada@example.com",
  phone: "",
  company: "",
  serviceInterest: "web",
  budget: "",
  message: "Need a custom portal built",
};

beforeEach(() => {
  createLeadAction.mockReset();
  requestPasswordReset.mockReset();
});

describe("submitInquiry (BUG-049/050)", () => {
  it("calls createLead with product_cta + productId and maps success", async () => {
    createLeadAction.mockResolvedValue({ ok: true, data: { leadId: "abcdef12-0000" } });
    const r = await submitInquiry(values, "product_cta", "11111111-1111-4111-8111-111111111111");
    expect(createLeadAction).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "product_cta",
        productId: "11111111-1111-4111-8111-111111111111",
        serviceInterest: ["web"],
        phone: undefined,
      }),
    );
    expect(r).toEqual({ ok: true, reference: "ABCDEF12" });
  });

  it("surfaces failure, never fake success", async () => {
    createLeadAction.mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION", message: "Bad" },
    });
    expect(await submitInquiry(values, "inquiry_form")).toEqual({ ok: false, error: "Bad" });
    createLeadAction.mockRejectedValue(new Error("net"));
    expect((await submitInquiry(values, "inquiry_form")).ok).toBe(false);
  });

  it("InquiryForm default submit hits createLead and shows error on failure", async () => {
    createLeadAction.mockResolvedValue({ ok: false, error: { code: "INTERNAL", message: "Nope" } });
    render(<InquiryForm serviceOptions={[]} defaults={values} />);
    fireEvent.click(screen.getByRole("button", { name: /send inquiry/i }));
    await waitFor(() => expect(screen.getByText("Nope")).toBeTruthy());
    expect(createLeadAction).toHaveBeenCalledTimes(1);
  });
});

describe("ResetPasswordScreen request (BUG-051)", () => {
  function submit(email: string) {
    render(<ResetPasswordScreen step="request" />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
  }

  it("calls requestPasswordReset and shows neutral message", async () => {
    requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });
    submit("a@b.co");
    await waitFor(() => expect(screen.getByText(/If an account exists/i)).toBeTruthy());
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "a@b.co",
      redirectTo: "/auth/reset",
    });
  });

  it("shows error, not success, when request fails", async () => {
    requestPasswordReset.mockResolvedValue({ data: null, error: { message: "x" } });
    submit("a@b.co");
    await waitFor(() => expect(screen.getByText(/couldn't send/i)).toBeTruthy());
    expect(screen.queryByText(/If an account exists/i)).toBeNull();
  });
});
