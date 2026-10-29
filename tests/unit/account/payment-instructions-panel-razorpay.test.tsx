import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { GatewayInstructions } from "@/modules/payments/provider";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const { submitPaymentReferenceMock } = vi.hoisted(() => ({ submitPaymentReferenceMock: vi.fn() }));
vi.mock("@/modules/payments/customer-mutations", () => ({
  submitPaymentReference: submitPaymentReferenceMock,
}));

import { PaymentInstructionsPanel } from "@/components/account/PaymentInstructionsPanel";

const RAZORPAY_INSTRUCTIONS: GatewayInstructions = {
  method: "razorpay",
  kind: "client_sdk",
  razorpayOrderId: "order_abc123",
  keyId: "rzp_test_abc123",
  amount: { amountMinor: 50000, currency: "INR" },
  currency: "INR",
  orderNo: "CK-ORD-000042",
};

/** Fake `window.Razorpay` standing in for the real `checkout.js` — captures the options so tests
 * can trigger `handler`/`modal.ondismiss`/the `payment.failed` listener directly. */
class FakeRazorpay {
  static lastInstance: FakeRazorpay | undefined;
  opened = false;
  failedHandler: ((resp: { error?: { description?: string } }) => void) | undefined;
  constructor(public options: Record<string, unknown>) {
    FakeRazorpay.lastInstance = this;
  }
  on(event: string, handler: (resp: { error?: { description?: string } }) => void) {
    if (event === "payment.failed") this.failedHandler = handler;
  }
  open() {
    this.opened = true;
  }
}

function installFakeRazorpay() {
  (window as unknown as { Razorpay: unknown }).Razorpay = FakeRazorpay;
}

function renderRazorpayPanel() {
  render(
    <PaymentInstructionsPanel
      orderNo="CK-ORD-000042"
      paymentId="pay-1"
      instructions={RAZORPAY_INSTRUCTIONS}
      expiresAt={new Date(Date.now() + 86_400_000).toISOString()}
      dashboardHref="/account/purchases"
    />,
  );
}

describe("PaymentInstructionsPanel > Razorpay Checkout.js flow (D-501, TEST MODE ONLY)", () => {
  afterEach(() => {
    cleanup();
    submitPaymentReferenceMock.mockReset();
    delete (window as unknown as { Razorpay?: unknown }).Razorpay;
    FakeRazorpay.lastInstance = undefined;
  });

  it("packs the reference as order_id:payment_id:signature on success and reuses submitPaymentReference", async () => {
    installFakeRazorpay();
    submitPaymentReferenceMock.mockResolvedValue({
      ok: true,
      data: { payment: { paymentId: "pay-1", status: "submitted" } },
    });
    renderRazorpayPanel();

    fireEvent.click(screen.getByRole("button", { name: /Pay now/i }));
    await waitFor(() => expect(FakeRazorpay.lastInstance?.opened).toBe(true));

    const handler = FakeRazorpay.lastInstance!.options.handler as (resp: unknown) => void;
    await act(async () => {
      handler({
        razorpay_order_id: "order_abc123",
        razorpay_payment_id: "pay_xyz789",
        razorpay_signature: "deadbeef1234",
      });
    });

    await waitFor(() => expect(submitPaymentReferenceMock).toHaveBeenCalledTimes(1));
    expect(submitPaymentReferenceMock).toHaveBeenCalledWith({
      paymentId: "pay-1",
      reference: "order_abc123:pay_xyz789:deadbeef1234",
    });
    expect(screen.getByText(/Reference submitted — awaiting confirmation/i)).toBeInTheDocument();
  });

  it("shows a cancelled state when the admin/customer dismisses the Checkout.js modal", async () => {
    installFakeRazorpay();
    renderRazorpayPanel();

    fireEvent.click(screen.getByRole("button", { name: /Pay now/i }));
    await waitFor(() => expect(FakeRazorpay.lastInstance?.opened).toBe(true));

    const onDismiss = (FakeRazorpay.lastInstance!.options.modal as { ondismiss: () => void })
      .ondismiss;
    act(() => onDismiss());

    expect(await screen.findByText(/Payment cancelled/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry payment/i })).toBeInTheDocument();
    expect(submitPaymentReferenceMock).not.toHaveBeenCalled();
  });

  it("shows a failed state when Checkout.js reports payment.failed", async () => {
    installFakeRazorpay();
    renderRazorpayPanel();

    fireEvent.click(screen.getByRole("button", { name: /Pay now/i }));
    await waitFor(() => expect(FakeRazorpay.lastInstance?.opened).toBe(true));

    act(() =>
      FakeRazorpay.lastInstance!.failedHandler?.({
        error: { description: "Card declined by issuer" },
      }),
    );

    expect(await screen.findByText(/Payment failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Card declined by issuer/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry payment/i })).toBeInTheDocument();
    expect(submitPaymentReferenceMock).not.toHaveBeenCalled();
  });

  it("shows the server's error and lets the customer retry when submitPaymentReference fails after a real Checkout.js success", async () => {
    installFakeRazorpay();
    submitPaymentReferenceMock.mockResolvedValue({
      ok: false,
      error: { code: "STATE_INVALID", message: "Order has expired" },
    });
    renderRazorpayPanel();

    fireEvent.click(screen.getByRole("button", { name: /Pay now/i }));
    await waitFor(() => expect(FakeRazorpay.lastInstance?.opened).toBe(true));
    const handler = FakeRazorpay.lastInstance!.options.handler as (resp: unknown) => void;
    await act(async () => {
      handler({
        razorpay_order_id: "order_abc123",
        razorpay_payment_id: "pay_xyz789",
        razorpay_signature: "deadbeef1234",
      });
    });

    expect(await screen.findByText(/Order has expired/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry payment/i })).toBeInTheDocument();
  });
});
