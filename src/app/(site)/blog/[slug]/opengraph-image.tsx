import { anonymousContext } from "@/lib/authz/context";
import { OG_CONTENT_TYPE, OG_SIZE, safeOg } from "@/lib/og-image";
import { getBlogBySlugQuery } from "@/modules/blog/queries";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getBlogBySlugQuery({ slug, displayCurrency: "INR" }, anonymousContext());
  return safeOg(r.ok ? r.data.blog.title : null, "Blog");
}
