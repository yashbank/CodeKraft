import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/leads",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/modules/leads/admin-mutations", () => ({
  createLeadManual: vi.fn(async () => ({ ok: true, data: { leadId: "lead-new-1" } })),
  assignLead: vi.fn(),
  claimLead: vi.fn(),
  setLeadFollowUp: vi.fn(),
  updateLeadStatus: vi.fn(),
  markLeadWon: vi.fn(),
  markLeadLost: vi.fn(),
}));

import { LeadsScreen } from "@/components/admin/crm/LeadsScreen";
import { ADMINS, LEADS, NOW, PRIYA } from "@/app/dev/screens/_fixtures/admin";

afterEach(() => cleanup());

describe("LeadsScreen create (BUG-090)", () => {
  it("shows the new lead in the list without a reload", async () => {
    render(
      <LeadsScreen
        leads={LEADS}
        admins={ADMINS}
        currentUser={PRIYA}
        now={NOW}
        detailHref="/admin/leads"
        newOrderHref="/admin/orders/new"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /new lead/i }));
    fireEvent.change(document.getElementById("nl-name") as HTMLInputElement, {
      target: { value: "Zed Freshlead" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create lead/i }));
    await waitFor(() => expect(screen.getAllByText("Zed Freshlead").length).toBeGreaterThan(0));
  });
});
