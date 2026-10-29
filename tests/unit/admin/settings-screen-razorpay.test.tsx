import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/settings",
}));

const { updateRazorpaySettingsMock, testRazorpayConnectionMock } = vi.hoisted(() => ({
  updateRazorpaySettingsMock: vi.fn(),
  testRazorpayConnectionMock: vi.fn(),
}));

vi.mock("@/modules/settings/admin-mutations", () => ({
  updateRazorpaySettings: updateRazorpaySettingsMock,
}));
vi.mock("@/modules/settings/razorpay-test-connection", () => ({
  testRazorpayConnection: testRazorpayConnectionMock,
}));

import { SettingsScreen } from "@/components/admin/system/SettingsScreen";
import { SETTINGS } from "@/app/dev/screens/_fixtures/admin";

const RAZORPAY_FIXTURE = {
  enabled: false,
  mode: "test" as const,
  keyId: "rzp_test_1234567890",
  keySecretMasked: "****************1234",
  webhookSecretMasked: "",
  webhookUrl: "https://codekraft.example/api/webhooks/razorpay",
};

function renderOnPaymentsSection() {
  render(
    <SettingsScreen
      settings={{ ...SETTINGS, payments: { ...SETTINGS.payments, razorpay: RAZORPAY_FIXTURE } }}
      isSuperAdmin={true}
      environment="development"
      initialSection="payment-methods"
      chatbotHref="/admin/chatbot"
      auditHref="/admin/audit"
    />,
  );
}

describe("SettingsScreen > Payments > Razorpay (D-501, TEST MODE ONLY)", () => {
  afterEach(() => {
    cleanup();
    updateRazorpaySettingsMock.mockReset();
    testRazorpayConnectionMock.mockReset();
  });

  it("shows the masked secret, never the real value, and the webhook URL", () => {
    renderOnPaymentsSection();

    const keySecretInput = screen.getByLabelText("Key secret") as HTMLInputElement;
    expect(keySecretInput.value).toBe(""); // never pre-filled with the real/masked value
    expect(keySecretInput.placeholder).toBe(RAZORPAY_FIXTURE.keySecretMasked);
    expect(keySecretInput.type).toBe("password");

    expect(screen.getByLabelText("Key ID")).toHaveValue(RAZORPAY_FIXTURE.keyId);
    expect(screen.getByDisplayValue(RAZORPAY_FIXTURE.webhookUrl)).toBeInTheDocument();
  });

  it("saves WITHOUT a keySecret/webhookSecret field when the admin didn't retype them", async () => {
    updateRazorpaySettingsMock.mockResolvedValue({ ok: true, data: { settings: {} } });
    renderOnPaymentsSection();

    fireEvent.click(screen.getByRole("button", { name: /Save Razorpay settings/i }));

    await waitFor(() => expect(updateRazorpaySettingsMock).toHaveBeenCalledTimes(1));
    const [patch] = updateRazorpaySettingsMock.mock.calls[0]!;
    expect(patch).not.toHaveProperty("keySecret");
    expect(patch).not.toHaveProperty("webhookSecret");
    expect(patch.keyId).toBe(RAZORPAY_FIXTURE.keyId);
  });

  it("sends the retyped secret as the new value — never the masked placeholder", async () => {
    updateRazorpaySettingsMock.mockResolvedValue({ ok: true, data: { settings: {} } });
    renderOnPaymentsSection();

    fireEvent.change(screen.getByLabelText("Key secret"), {
      target: { value: "a-brand-new-real-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Razorpay settings/i }));

    await waitFor(() => expect(updateRazorpaySettingsMock).toHaveBeenCalledTimes(1));
    const [patch] = updateRazorpaySettingsMock.mock.calls[0]!;
    expect(patch.keySecret).toBe("a-brand-new-real-secret");
    expect(patch.keySecret).not.toBe(RAZORPAY_FIXTURE.keySecretMasked);
  });

  it("shows a success banner when the test connection succeeds", async () => {
    testRazorpayConnectionMock.mockResolvedValue({ ok: true, data: { ok: true } });
    renderOnPaymentsSection();

    fireEvent.click(screen.getByRole("button", { name: /Test connection/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/Connected — Razorpay accepted the credentials/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows the server's safe failure message when the test connection fails", async () => {
    testRazorpayConnectionMock.mockResolvedValue({
      ok: false,
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Connection failed: Razorpay rejected the test request",
      },
    });
    renderOnPaymentsSection();

    fireEvent.click(screen.getByRole("button", { name: /Test connection/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/Connection failed: Razorpay rejected the test request/i),
      ).toBeInTheDocument(),
    );
  });

  it("enable switch reflects the provider_razorpay flag and toggles independently", () => {
    renderOnPaymentsSection();
    const toggle = screen.getByRole("switch", { name: /Razorpay enabled/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});
