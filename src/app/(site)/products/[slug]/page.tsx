import type { Metadata } from "next";

import { getDisplayCurrency } from "@/lib/display-currency";
import { ProductView, productMetadata } from "../../_views/product-detail";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Dynamic variant for visitors with a currency cookie or a session; everyone else is rewritten by
// middleware to the ISR twin at ../../ssg/products/[slug].
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return productMetadata(slug, (await getDisplayCurrency()).currency);
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  return <ProductView slug={slug} currency={(await getDisplayCurrency()).currency} />;
}
