import type { Metadata } from "next";

import { anonymousContext } from "@/lib/authz/context";
import { toProductSummary } from "@/lib/product-summary";
import { listCategoriesQuery, listProductsQuery } from "@/modules/catalog/queries";
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

export default async function ProductsPage() {
  const ctx = anonymousContext();
  const [productsResult, categoriesResult] = await Promise.all([
    listProductsQuery({ limit: 100, displayCurrency: "INR" }, ctx),
    listCategoriesQuery({}, ctx),
  ]);

  const products = productsResult.ok ? productsResult.data.map(toProductSummary) : [];
  const categories = categoriesResult.ok ? toCategoryTree(categoriesResult.data) : [];

  return <ProductsListPage products={products} categories={categories} pageSize={12} />;
}
