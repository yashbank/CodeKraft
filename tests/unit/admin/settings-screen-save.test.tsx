import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/settings",
}));

const { updateSettingsMock } = vi.hoisted(() => ({ updateSettingsMock: vi.fn() }));
vi.mock("@/modules/settings/admin-mutations", () => ({
  updateSettings: updateSettingsMock,
  updateRazorpaySettings: vi.fn(),
}));
vi.mock("@/modules/settings/razorpay-test-connection", () => ({ testRazorpayConnection: vi.fn() }));

import { SettingsScreen } from "@/components/admin/system/SettingsScreen";
import { SETTINGS } from "@/app/dev/screens/_fixtures/admin";

function renderAt(initialSection: "tax" | "general" | "currencies") {
  render(
    <SettingsScreen
      settings={SETTINGS}
      isSuperAdmin={true}
      environment="development"
      initialSection={initialSection}
      chatbotHref="/admin/chatbot"
      auditHref="/admin/audit"
    />,
  );
}

describe("SettingsScreen save (BUG-059)", () => {
  afterEach(() => {
    cleanup();
    updateSettingsMock.mockReset();
  });

  it("tax section persists via updateSettings", async () => {
    updateSettingsMock.mockResolvedValue({ ok: true, data: {} });
    renderAt("tax");
    fireEvent.change(screen.getByLabelText(/Tax rate/), { target: { value: "18" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateSettingsMock).toHaveBeenCalled());
    expect(updateSettingsMock.mock.calls[0]![0].patch.taxRateBps).toBe(1800);
  });

  it("sections without backend disable Save with a note", () => {
    renderAt("currencies");
    expect(
      (screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText(/not available yet/)).toBeTruthy();
    expect(updateSettingsMock).not.toHaveBeenCalled();
  });

  it("general section persists siteName and seller details (BUG-088)", async () => {
    updateSettingsMock.mockResolvedValue({ ok: true, data: {} });
    renderAt("general");
    fireEvent.change(screen.getByLabelText(/Site name/), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText(/Address line 1/), { target: { value: "1 Main St" } });
    fireEvent.change(screen.getByLabelText(/^City/), { target: { value: "Pune" } });
    fireEvent.change(screen.getByLabelText(/Postal code/), { target: { value: "411001" } });
    fireEvent.change(screen.getByLabelText(/^Country/), { target: { value: "in" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateSettingsMock).toHaveBeenCalled());
    const patch = updateSettingsMock.mock.calls[0]![0].patch;
    expect(patch.siteName).toBe("Acme");
    expect(patch.sellerDetails.address).toMatchObject({
      line1: "1 Main St",
      city: "Pune",
      country: "IN",
    });
  });

  it("general section shows field errors from the server", async () => {
    updateSettingsMock.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Some fields are invalid.",
        fieldErrors: { "patch.sellerDetails.email": ["Invalid email address"] },
      },
    });
    renderAt("general");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Invalid email address")).toBeTruthy();
  });
});
