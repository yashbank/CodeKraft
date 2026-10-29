import { safeJsonLd } from "@/lib/seo";

/** Server component: one <script type="application/ld+json">, safely escaped. */
export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />;
}
