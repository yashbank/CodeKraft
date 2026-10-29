import type { Metadata } from "next";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { getEnabledCurrencies } from "@/lib/display-currency";
import { ProductView, productMetadata } from "../../../_views/product-detail";
import { products } from "../../../../../../drizzle/schema/catalog";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ISR twin of /products/[slug] for anonymous visitors without a currency cookie (middleware
// rewrite). Pages render on first hit then revalidate; admin catalog saves revalidate the layout.
export const revalidate = 300;

// Next only treats a rewritten request as ISR when its path is prerendered (the rewrite is not
// seen when matching on-demand dynamic routes), so the published slugs are built up front.
// Products published later render per request (correct, uncached) until the next deploy.
export async function generateStaticParams() {
  try {
    const rows = await db
      .select({ slug: products.slug })
      .from(products)
      .where(eq(products.status, "published"));
    return rows;
  } catch {
    return []; // no database at build: every product renders per request
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return productMetadata(slug, (await getEnabledCurrencies()).base);
}

export default async function StaticProductPage({ params }: PageProps) {
  const { slug } = await params;
  return <ProductView slug={slug} currency={(await getEnabledCurrencies()).base} />;
}
