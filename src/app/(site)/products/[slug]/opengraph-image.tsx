import { anonymousContext } from "@/lib/authz/context";
import { OG_CONTENT_TYPE, OG_SIZE, safeOg } from "@/lib/og-image";
import { getProductBySlugQuery } from "@/modules/catalog/queries";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getProductBySlugQuery({ slug, displayCurrency: "INR" }, anonymousContext());
  return safeOg(r.ok ? r.data.name : null, "Product");
}
