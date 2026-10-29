import { getDisplayCurrency } from "@/lib/display-currency";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";

import { getSession } from "@/modules/auth/service";
import { ProductsView } from "../_views/products-list";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  return pageMetadata({
    path: "/products",
    title: "Products & Software Solutions",
    description:
      "Explore our ready-to-deploy SaaS applications, business tools, and developer platforms. Built with modern architecture and complete ownership.",
    noindex: Boolean(q),
  });
}

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

// Dynamic variant: search queries, visitors with a currency cookie or a session. Everyone else is
// rewritten by middleware to the static twin at ../ssg/products.
export default async function ProductsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const { currency } = await getDisplayCurrency();
  const session = await getSession();
  return <ProductsView currency={currency} q={q} signedIn={Boolean(session)} />;
}
