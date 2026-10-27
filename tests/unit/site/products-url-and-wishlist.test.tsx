import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const routerMocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const searchParamsMock = vi.hoisted(() => ({ current: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
  usePathname: () => "/products",
  useSearchParams: () => searchParamsMock.current,
}));

const toggleWishlistMock = vi.hoisted(() => vi.fn());
vi.mock("@/modules/catalog/site-mutations", () => ({
  toggleWishlist: toggleWishlistMock,
}));

import { ProductsListPage } from "@/components/site/ProductsListPage";
import { CATEGORY_TREE, PRODUCTS } from "@/app/dev/screens/_fixtures/site";

describe("ProductsListPage — URL filter sync (BUG-025) and wishlist (BUG-015)", () => {
  beforeEach(() => {
    routerMocks.push.mockClear();
    routerMocks.replace.mockClear();
    toggleWishlistMock.mockReset().mockResolvedValue({ ok: true, data: { wishlisted: true } });
    searchParamsMock.current = new URLSearchParams();
  });

  it("restores an active filter count from the URL on load", () => {
    searchParamsMock.current = new URLSearchParams(`category=${CATEGORY_TREE[0]!.slug}`);
    render(<ProductsListPage products={PRODUCTS} categories={CATEGORY_TREE} pageSize={12} />);

    expect(screen.getByRole("button", { name: /Filters \(1\)/ })).toBeInTheDocument();
  });

  it("pushes the view choice into the URL so it's shareable and back/forward restores it", () => {
    render(<ProductsListPage products={PRODUCTS} categories={CATEGORY_TREE} pageSize={12} />);

    fireEvent.click(screen.getByRole("button", { name: "List view" }));

    expect(routerMocks.push).toHaveBeenCalledWith(
      expect.stringContaining("view=list"),
      expect.objectContaining({ scroll: false }),
    );
  });

  it("logged-out: wishlist heart on a product card links to login with a way back", () => {
    render(<ProductsListPage products={PRODUCTS} categories={CATEGORY_TREE} pageSize={12} />);

    const link = screen.getAllByRole("link", { name: "Sign in to add to wishlist" })[0];
    expect(link).toHaveAttribute("href", expect.stringContaining("/auth/login?next="));
  });

  it("signed-in: clicking the heart toggles the wishlist via the real backend action", async () => {
    const product = PRODUCTS[0]!;
    render(
      <ProductsListPage
        products={PRODUCTS}
        categories={CATEGORY_TREE}
        pageSize={12}
        signedIn
        wishlistedIds={[product.id]}
      />,
    );

    const button = screen.getAllByRole("button", { name: "Remove from wishlist" })[0]!;
    fireEvent.click(button);

    expect(toggleWishlistMock).toHaveBeenCalledWith({ productId: product.id, on: false });
  });

  it("BUG-078: a search with no matches shows the empty state, not just an empty grid", () => {
    searchParamsMock.current = new URLSearchParams("q=zzzznomatch");
    render(<ProductsListPage products={PRODUCTS} categories={CATEGORY_TREE} pageSize={12} />);

    expect(screen.getByText("0 products")).toBeInTheDocument();
    expect(screen.getByText(/No products match/)).toBeInTheDocument();
  });
});
