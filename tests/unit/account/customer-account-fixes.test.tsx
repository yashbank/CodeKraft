import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
  usePathname: () => "/account",
  useSearchParams: () => new URLSearchParams(),
}));

const { submitRef, replyMine } = vi.hoisted(() => ({ submitRef: vi.fn(), replyMine: vi.fn() }));
vi.mock("@/modules/payments/customer-mutations", () => ({ submitPaymentReference: submitRef }));
vi.mock("@/modules/queries/customer-mutations", () => ({
  createQuery: vi.fn(),
  replyToMyQuery: replyMine,
}));

import { OrderStatusScreen } from "@/components/account/OrderStatusScreen";
import { QueryThreadScreen } from "@/components/account/QueriesScreen";
import { orders, queries } from "@/app/dev/screens/_fixtures/account";

const links = { purchases: "/p", newQuery: "/q", product: "/pr" };

describe("customer account fixes", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("BUG-048: order status reference form calls submitPaymentReference", async () => {
    submitRef.mockResolvedValue({ ok: true, data: {} });
    const order = {
      ...orders.awaitingReference,
      payment: { id: "pay-1", status: "initiated" as const },
    };
    render(<OrderStatusScreen order={order} now="2026-09-25T00:00:00Z" links={links} />);
    fireEvent.change(screen.getByLabelText(/Transaction reference/), {
      target: { value: "UTR1234567" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit reference/ }));
    await waitFor(() =>
      expect(submitRef).toHaveBeenCalledWith({ paymentId: "pay-1", reference: "UTR1234567" }),
    );
  });

  it("BUG-054: Mark resolved calls replyToMyQuery with setStatus resolved", async () => {
    replyMine.mockResolvedValue({ ok: true, data: {} });
    const q = queries.find((x) => x.status === "waiting_customer" || x.status === "open")!;
    render(<QueryThreadScreen query={q} now="2026-09-25T00:00:00Z" links={{ queries: "/q" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark resolved" }));
    await waitFor(() => expect(replyMine).toHaveBeenCalled());
    expect(replyMine.mock.calls[0]![0]).toMatchObject({ queryId: q.id, setStatus: "resolved" });
  });
});
