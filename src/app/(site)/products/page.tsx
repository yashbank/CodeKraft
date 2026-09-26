import type { Metadata } from "next";

import { CATEGORY_TREE, PRODUCTS } from "@/app/dev/screens/_fixtures/site";
import { ProductsListPage } from "@/components/site/ProductsListPage";

export const metadata: Metadata = {
  title: "Products & Software Solutions — CodeKraft",
  description:
    "Explore our ready-to-deploy SaaS applications, business tools, and developer platforms. Built with modern architecture and complete ownership.",
};

export default function ProductsPage() {
  return (
    <ProductsListPage
      products={PRODUCTS}
      categories={CATEGORY_TREE}
      pageSize={12}
    />
  );
}
