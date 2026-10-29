import { anonymousContext } from "@/lib/authz/context";
import type { Currency } from "@/lib/money";
import { toProductSummary } from "@/lib/product-summary";
import {
  listCategoriesQuery,
  listMyWishlistQuery,
  listProductsQuery,
} from "@/modules/catalog/queries";
import { ProductsListPage } from "@/components/site/ProductsListPage";
import type { CategoryNode } from "@/components/site/ProductFilters";
import type { CategoryNode as CatalogCategoryNode } from "@/modules/catalog/types";

function toCategoryTree(nodes: CatalogCategoryNode[]): CategoryNode[] {
  return nodes.map((n) => ({
    slug: n.slug,
    name: n.name,
    children: n.children.map((c) => ({ slug: c.slug, name: c.name })),
  }));
}

/** Products list for one display currency; `signedIn` adds the visitor's wishlist (dynamic route only). */
export async function ProductsView({
  currency,
  q,
  signedIn = false,
}: {
  currency: Currency;
  q?: string;
  signedIn?: boolean;
}) {
  const ctx = anonymousContext();
  const [productsResult, categoriesResult] = await Promise.all([
    listProductsQuery({ limit: 100, displayCurrency: currency }, ctx),
    listCategoriesQuery({}, ctx),
  ]);

  const products = productsResult.ok ? productsResult.data.map(toProductSummary) : [];
  const categories = categoriesResult.ok ? toCategoryTree(categoriesResult.data) : [];

  let wishlistedIds: string[] = [];
  if (signedIn) {
    const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
    const wishlistCtx = await getSiteRequestContext();
    const wishlistResult = await listMyWishlistQuery(
      { limit: 100, displayCurrency: currency },
      wishlistCtx,
    );
    if (wishlistResult.ok) wishlistedIds = wishlistResult.data.items.map((i) => i.productId);
  }

  return (
    <ProductsListPage
      products={products}
      categories={categories}
      pageSize={12}
      initialQuery={q}
      signedIn={signedIn}
      wishlistedIds={wishlistedIds}
    />
  );
}
