import { afterEach, describe, expect, it, vi } from "vitest";
import { buildContext } from "@/lib/authz/context";

const { loadMock, updateSettingsActionMock, getAdminRequestContextMock } = vi.hoisted(() => ({
  loadMock: vi.fn(),
  updateSettingsActionMock: vi.fn(),
  getAdminRequestContextMock: vi.fn(),
}));

vi.mock("@/modules/settings/service", () => ({
  settingsService: { load: loadMock },
}));
vi.mock("@/modules/settings/actions", () => ({
  updateSettingsAction: updateSettingsActionMock,
}));
vi.mock("@/lib/authz/admin-request-context", () => ({
  getAdminRequestContext: getAdminRequestContextMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateRazorpaySettings } from "@/modules/settings/admin-mutations";

const superAdminCtx = buildContext({
  user: { id: "admin-1" },
  session: { id: "sess-1" },
  roles: ["super_admin"],
});

describe("updateRazorpaySettings (admin Settings > Payments save, D-501, TEST MODE ONLY)", () => {
  afterEach(() => {
    loadMock.mockReset();
    updateSettingsActionMock.mockReset();
    getAdminRequestContextMock.mockReset();
  });

  it("preserves the PERSISTED secrets when the admin doesn't retype them — never resubmits a masked placeholder as real", async () => {
    getAdminRequestContextMock.mockResolvedValue(superAdminCtx);
    loadMock.mockResolvedValue({
      razorpaySettings: {
        mode: "test",
        keyId: "rzp_test_old",
        keySecret: "real_persisted_secret",
        webhookSecret: "real_persisted_webhook",
      },
    });
    updateSettingsActionMock.mockResolvedValue({ ok: true, data: { settings: {} } });

    const res = await updateRazorpaySettings({
      mode: "test",
      keyId: "rzp_test_new", // admin changed just the key id
      enabled: true,
      // keySecret / webhookSecret omitted — admin didn't retype them
    });

    expect(res.ok).toBe(true);
    expect(updateSettingsActionMock).toHaveBeenCalledTimes(1);
    const [patchArg] = updateSettingsActionMock.mock.calls[0]!;
    expect(patchArg.patch.razorpaySettings).toEqual({
      mode: "test",
      keyId: "rzp_test_new",
      keySecret: "real_persisted_secret",
      webhookSecret: "real_persisted_webhook",
    });
    expect(patchArg.patch.flags).toEqual({ provider_razorpay: true });
  });

  it("sends the retyped secret when the admin does provide a new one", async () => {
    getAdminRequestContextMock.mockResolvedValue(superAdminCtx);
    loadMock.mockResolvedValue({
      razorpaySettings: {
        mode: "test",
        keyId: "rzp_test_old",
        keySecret: "old_secret",
        webhookSecret: "old_webhook",
      },
    });
    updateSettingsActionMock.mockResolvedValue({ ok: true, data: { settings: {} } });

    await updateRazorpaySettings({
      mode: "live",
      keyId: "rzp_live_x",
      keySecret: "brand_new_secret",
      enabled: false,
    });

    const [patchArg] = updateSettingsActionMock.mock.calls[0]!;
    expect(patchArg.patch.razorpaySettings).toEqual({
      mode: "live",
      keyId: "rzp_live_x",
      keySecret: "brand_new_secret",
      webhookSecret: "old_webhook",
    });
    expect(patchArg.patch.flags).toEqual({ provider_razorpay: false });
  });

  it("works with no prior razorpaySettings row (first-time setup) — secrets default to null when omitted", async () => {
    getAdminRequestContextMock.mockResolvedValue(superAdminCtx);
    loadMock.mockResolvedValue({ razorpaySettings: null });
    updateSettingsActionMock.mockResolvedValue({ ok: true, data: { settings: {} } });

    await updateRazorpaySettings({ mode: "test", keyId: "rzp_test_first", enabled: false });

    const [patchArg] = updateSettingsActionMock.mock.calls[0]!;
    expect(patchArg.patch.razorpaySettings).toEqual({
      mode: "test",
      keyId: "rzp_test_first",
      keySecret: null,
      webhookSecret: null,
    });
  });

  it("rejects without calling updateSettingsAction when the caller lacks settings.write", async () => {
    getAdminRequestContextMock.mockResolvedValue(
      buildContext({ user: { id: "u2" }, session: { id: "s2" }, roles: ["user"] }),
    );

    const res = await updateRazorpaySettings({ mode: "test", keyId: "x", enabled: true });

    expect(res.ok).toBe(false);
    expect(updateSettingsActionMock).not.toHaveBeenCalled();
    expect(loadMock).not.toHaveBeenCalled();
  });

  it("fails validation (never reaching updateSettingsAction) on a malformed patch", async () => {
    getAdminRequestContextMock.mockResolvedValue(superAdminCtx);

    const res = await updateRazorpaySettings({ mode: "sandbox", keyId: "x", enabled: true });

    expect(res.ok).toBe(false);
    expect(updateSettingsActionMock).not.toHaveBeenCalled();
  });
});
