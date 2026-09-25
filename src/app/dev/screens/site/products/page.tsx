import { ProductsListPage } from "@/components/site/ProductsListPage";

import { CATEGORY_TREE, PRODUCTS } from "../../_fixtures/site";
import { readState, SitePreview, type SearchParams } from "../_shared";

export const metadata = { title: "SCR-SITE-03 Products list" };

const STATES = [
  { id: "default", label: "Default" },
  { id: "loading", label: "Loading" },
  { id: "no-results", label: "No results" },
  { id: "empty", label: "Catalogue empty" },
  { id: "search-down", label: "Search unavailable" },
  { id: "paginated", label: "Pagination (2/page)" },
];

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams);
  return (
    <SitePreview
      href="/dev/screens/site/products"
      states={STATES}
      current={state}
      currentPath="/products"
    >
      <ProductsListPage
        key={state}
        products={state === "empty" ? [] : PRODUCTS}
        categories={CATEGORY_TREE}
        loading={state === "loading"}
        searchUnavailable={state === "search-down"}
        initialQuery={state === "no-results" ? "quantum ledger" : ""}
        pageSize={state === "paginated" ? 2 : 25}
      />
    </SitePreview>
  );
}
