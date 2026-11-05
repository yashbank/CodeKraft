import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/quotes",
}));

import { QuotesScreen } from "@/components/admin/commerce/QuotesScreen";

function setup() {
  render(<QuotesScreen quotes={[]} customers={[]} orderHref="/o" customerHref="/c" />);
  const preview = () => screen.getByText("Email preview").parentElement!.textContent ?? "";
  const type = (label: RegExp, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  return { preview, type };
}

afterEach(cleanup);

describe("D17-03 quote email preview follows the live form", () => {
  it("shows the typed price in major units, with title and tax-inclusive total", () => {
    const { preview, type } = setup();
    type(/^Title/, "Site audit");
    type(/^Price/, "575");
    expect(preview()).toContain("Site audit");
    expect(preview()).toContain("₹575.00");
    type(/^Tax/, "18");
    expect(preview()).toContain("₹678.50");
    type(/^Valid until/, "2030-01-15");
    expect(preview()).toMatch(/15 Jan 2030|Jan 15, 2030/);
  });

  it("blank or invalid price shows a dash, never NaN", () => {
    const { preview, type } = setup();
    expect(preview()).not.toContain("₹0.00");
    type(/^Price/, "abc");
    expect(preview()).not.toContain("NaN");
    expect(preview()).not.toContain("₹");
  });
});
