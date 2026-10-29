import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const { ok } = vi.hoisted(() => ({ ok: vi.fn(async () => ({ ok: true, data: {} })) }));
vi.mock("@/modules/delivery/admin-mutations", () => ({ markDelivered: ok, setLicenseKey: ok }));
vi.mock("@/modules/entitlements/admin-mutations", () => ({
  resetDownloadCount: ok,
  revokeEntitlement: ok,
}));
vi.mock("@/modules/payments/admin-mutations", () => ({
  confirmPayment: ok,
  failPayment: ok,
  proposeRefund: ok,
}));

import { OrderDetail } from "@/components/admin/commerce/OrderDetail";
import { ORDER_DETAIL_PAID } from "@/app/dev/screens/_fixtures/admin";
import type { OrderDetailData } from "@/components/admin/types";

function render1(deliveryType: OrderDetailData["items"][number]["deliveryType"]) {
  const item = ORDER_DETAIL_PAID.items[0]!;
  const data: OrderDetailData = {
    ...ORDER_DETAIL_PAID,
    items: [
      {
        ...item,
        deliveryType,
        entitlement: {
          id: "ent-x",
          status: "active",
          provisioning: deliveryType === "hosted" ? "pending" : "n/a",
          downloadsUsed: 1,
          downloadCap: 3,
          keyIssued: false,
        },
      },
    ],
  };
  render(
    <OrderDetail
      data={data}
      approvers={["A"]}
      isSuperAdmin
      customerHref="/c"
      ledgerHref="/l"
      approvalsHref="/a"
      queriesHref="/q"
    />,
  );
  const panel = screen.getByText(/Entitlement ·/).closest("div")!.parentElement!;
  return within(panel);
}

describe("OrderDetail entitlement panel", () => {
  afterEach(() => {
    cleanup();
    ok.mockClear();
  });

  it("download: Reset count and Revoke call actions", async () => {
    const p = render1("download");
    fireEvent.click(p.getByRole("button", { name: "Reset count" }));
    await vi.waitFor(() => expect(ok).toHaveBeenCalledWith({ entitlementId: "ent-x" }));
    expect(p.getByRole("button", { name: "Revoke access" })).toBeEnabled();
  });

  it("license: Save calls setLicenseKey with typed key", async () => {
    const p = render1("license");
    const save = p.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    fireEvent.change(p.getByLabelText("License key"), { target: { value: "ABCD-1234-EFGH" } });
    fireEvent.click(save);
    await vi.waitFor(() =>
      expect(ok).toHaveBeenCalledWith({
        entitlementId: "ent-x",
        licenseKey: "ABCD-1234-EFGH",
        notifyEmail: true,
      }),
    );
  });

  it("custom: Mark delivered calls markDelivered", async () => {
    const p = render1("custom");
    fireEvent.click(p.getByRole("button", { name: "Mark delivered" }));
    await vi.waitFor(() => expect(ok).toHaveBeenCalledWith({ entitlementId: "ent-x" }));
  });

  it("hosted: R9-03 offers Mark delivered (was a dead end) plus Revoke", () => {
    const p = render1("hosted");
    expect(p.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Mark delivered",
      "Revoke access",
    ]);
  });

  it("revoke dialog calls revokeEntitlement with reason", async () => {
    const p = render1("download");
    fireEvent.click(p.getByRole("button", { name: "Revoke access" }));
    fireEvent.change(await screen.findByLabelText(/Reason/), { target: { value: "chargeback" } });
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.click(dialog.getByRole("button", { name: "Revoke access" }));
    await vi.waitFor(() =>
      expect(ok).toHaveBeenCalledWith({ entitlementId: "ent-x", reason: "chargeback" }),
    );
  });
});
