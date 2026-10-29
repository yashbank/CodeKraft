import { getEnabledCurrencies } from "@/lib/display-currency";

import { ProductsView } from "../../_views/products-list";

// Static metadata: the dynamic page's `generateMetadata` reads searchParams (would force dynamic).
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  path: "/products",
  title: "Products & Software Solutions",
  description:
    "Explore our ready-to-deploy SaaS applications, business tools, and developer platforms. Built with modern architecture and complete ownership.",
});

// ISR twin of /products for anonymous visitors without a currency cookie (see ../page.tsx).
export const revalidate = 300;

export default async function StaticProductsPage() {
  const { base } = await getEnabledCurrencies();
  return <ProductsView currency={base} />;
}
