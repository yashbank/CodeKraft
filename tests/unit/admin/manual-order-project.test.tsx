import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/modules/orders/admin-mutations", () => ({
  createManualOrder: vi.fn(async () => ({ ok: true, data: { orderId: "o1", orderNo: "N1" } })),
}));

import { ManualOrderForm } from "@/components/admin/commerce/ManualOrderForm";
import { createManualOrder } from "@/modules/orders/admin-mutations";
import { createManualOrderInput } from "@/modules/orders/types";

const P1 = "11111111-1111-4111-8111-111111111111";
const partners = [{ id: P1, name: "Asha" }];

function fill(pct: string) {
  render(
    <ManualOrderForm
      customers={[]}
      offerings={[]}
      partners={partners}
      approvers={["A"]}
      gstinConfigured={false}
      taxRateBps={1800}
      isSuperAdmin={false}
    />,
  );
  fireEvent.change(screen.getByLabelText(/Client name/), { target: { value: "Acme" } });
  fireEvent.change(screen.getByLabelText(/Client email/), { target: { value: "a@acme.com" } });
  fireEvent.change(screen.getByLabelText(/Line 1 description/), { target: { value: "Build" } });
  fireEvent.change(screen.getByLabelText(/Unit amount/), { target: { value: "1000" } });
  fireEvent.click(screen.getByRole("button", { name: /Add partner/i }));
  fireEvent.change(screen.getByLabelText("%", { selector: "#mo-split-1-pct-0" }), {
    target: { value: pct },
  });
  return screen.getByRole("button", { name: /Create & request split approval/ });
}

describe("ManualOrderForm project orders", () => {
  afterEach(cleanup);

  it("submits a schema-valid payload without payment", async () => {
    const btn = fill("100");
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    await vi.waitFor(() => expect(createManualOrder).toHaveBeenCalled());
    const payload = vi.mocked(createManualOrder).mock.calls[0]?.[0];
    expect(createManualOrderInput.safeParse(payload).success).toBe(true);
    expect(payload).not.toHaveProperty("payment");
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/admin/orders/o1"));
  });

  it("disables submit when partner shares sum to 90 %", () => {
    expect(fill("90")).toBeDisabled();
  });
});
