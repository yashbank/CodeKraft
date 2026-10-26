import type { Metadata } from "next";

import { anonymousContext } from "@/lib/authz/context";
import { getSession } from "@/modules/auth/service";
import { toProductSummary } from "@/lib/product-summary";
import {
  listCategoriesQuery,
  listMyWishlistQuery,
  listProductsQuery,
} from "@/modules/catalog/queries";
import { ProductsListPage } from "@/components/site/ProductsListPage";
import type { CategoryNode } from "@/components/site/ProductFilters";
import type { CategoryNode as CatalogCategoryNode } from "@/modules/catalog/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Products & Software Solutions — CodeKraft",
  description:
    "Explore our ready-to-deploy SaaS applications, business tools, and developer platforms. Built with modern architecture and complete ownership.",
};

function toCategoryTree(nodes: CatalogCategoryNode[]): CategoryNode[] {
  return nodes.map((n) => ({
    slug: n.slug,
    name: n.name,
    children: n.children.map((c) => ({ slug: c.slug, name: c.name })),
  }));
}

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const ctx = anonymousContext();
  const [productsResult, categoriesResult, session] = await Promise.all([
    listProductsQuery({ limit: 100, displayCurrency: "INR" }, ctx),
    listCategoriesQuery({}, ctx),
    getSession(),
  ]);

  const products = productsResult.ok ? productsResult.data.map(toProductSummary) : [];
  const categories = categoriesResult.ok ? toCategoryTree(categoriesResult.data) : [];

  let wishlistedIds: string[] = [];
  if (session) {
    const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
    const wishlistCtx = await getSiteRequestContext();
    const wishlistResult = await listMyWishlistQuery(
      { limit: 100, displayCurrency: "INR" },
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
      signedIn={Boolean(session)}
      wishlistedIds={wishlistedIds}
    />
  );
}
