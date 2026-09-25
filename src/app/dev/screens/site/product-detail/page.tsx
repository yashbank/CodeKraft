import { ProductDetailPage } from "@/components/site/product/ProductDetailPage";

import { PRODUCT_DETAIL, SERVICE_OPTIONS } from "../../_fixtures/site";
import { readState, SitePreview, type SearchParams } from "../_shared";

export const metadata = { title: "SCR-SITE-04 Product detail" };

const STATES = [
  { id: "default", label: "Visitor" },
  { id: "customer", label: "Customer (wishlisted)" },
  { id: "owned", label: "Customer owns Pro" },
  { id: "coming-soon", label: "Coming soon" },
  { id: "minimal", label: "No media / FAQs / blog" },
];

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams);
  const product =
    state === "coming-soon"
      ? { ...PRODUCT_DETAIL, isComingSoon: true }
      : state === "minimal"
        ? {
            ...PRODUCT_DETAIL,
            media: [],
            faqs: [],
            testimonials: [],
            changelog: [],
            hasPresentation: false,
            blog: undefined,
            liveDemoUrl: undefined,
          }
        : PRODUCT_DETAIL;
  return (
    <SitePreview
      href="/dev/screens/site/product-detail"
      states={STATES}
      current={state}
      currentPath="/products"
    >
      <ProductDetailPage
        key={state}
        product={product}
        serviceOptions={SERVICE_OPTIONS}
        signedIn={state === "customer" || state === "owned"}
        wishlisted={state === "customer" ? true : state === "owned" ? false : undefined}
        ownedOfferingIds={state === "owned" ? ["off-pro-m", "off-starter-m", "off-pro-a"] : []}
      />
    </SitePreview>
  );
}
