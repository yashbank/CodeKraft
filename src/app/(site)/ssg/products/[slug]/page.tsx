import type { Metadata } from "next";

import { getEnabledCurrencies } from "@/lib/display-currency";
import { ProductView, productMetadata } from "../../../_views/product-detail";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ISR twin of /products/[slug] for anonymous visitors without a currency cookie (middleware
// rewrite). Pages render on first hit then revalidate; admin catalog saves revalidate the layout.
export const revalidate = 300;

// Empty list opts the dynamic segment into ISR (rendered on demand, then cached).
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return productMetadata(slug, (await getEnabledCurrencies()).base);
}

export default async function StaticProductPage({ params }: PageProps) {
  const { slug } = await params;
  return <ProductView slug={slug} currency={(await getEnabledCurrencies()).base} />;
}
