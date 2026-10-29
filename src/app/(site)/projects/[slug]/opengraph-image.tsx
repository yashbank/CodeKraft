import { anonymousContext } from "@/lib/authz/context";
import { OG_CONTENT_TYPE, OG_SIZE, safeOg } from "@/lib/og-image";
import { getCaseStudyBySlugQuery } from "@/modules/content/queries";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getCaseStudyBySlugQuery({ slug }, anonymousContext());
  return safeOg(r.ok ? r.data.title : null, "Case study");
}
