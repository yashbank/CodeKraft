import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/products/x",
}));
vi.mock("@/modules/leads/site-actions", () => ({ submitLead: vi.fn() }));
vi.mock("@/modules/auth/client", () => ({ useSession: () => ({ data: { user: { id: "u" } } }) }));
const idsMock = vi.hoisted(() => vi.fn());
const toggleMock = vi.hoisted(() => vi.fn());
vi.mock("@/modules/catalog/site-queries", () => ({ getMyWishlistIds: idsMock }));
vi.mock("@/modules/catalog/site-mutations", () => ({ toggleWishlist: toggleMock }));

import { OfferingPanel } from "@/components/site/product/OfferingPanel";
import { PRODUCT_DETAIL, SERVICE_OPTIONS } from "@/app/dev/screens/_fixtures/site";

describe("OfferingPanel wishlist heart (BUG-083)", () => {
  beforeEach(() => {
    idsMock.mockReset().mockResolvedValue({ ok: true, data: [PRODUCT_DETAIL.id] });
    toggleMock.mockReset().mockResolvedValue({ ok: true, data: { wishlisted: false } });
  });

  it("loads saved state for a signed-in customer and removes on click", async () => {
    render(<OfferingPanel product={PRODUCT_DETAIL} serviceOptions={SERVICE_OPTIONS} />);
    const btn = await screen.findByRole("button", { name: "Remove from wishlist" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(btn);
    await waitFor(() =>
      expect(toggleMock).toHaveBeenCalledWith({ productId: PRODUCT_DETAIL.id, on: false }),
    );
  });
});
