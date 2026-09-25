import { LandingPage } from "@/components/site/landing/LandingPage";

import {
  BLOG_POSTS,
  CASE_STUDIES,
  CLIENT_LOGOS,
  FEATURED_PRODUCTS,
  LANDING,
  SERVICE_OPTIONS,
  SERVICES,
  TESTIMONIALS,
} from "../../_fixtures/site";
import { readState, SitePreview, type SearchParams } from "../_shared";

export const metadata = { title: "SCR-SITE-01 Landing" };

const STATES = [
  { id: "default", label: "Default" },
  { id: "no-products", label: "No products" },
  { id: "no-proof", label: "No case studies / blogs" },
];

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams);
  return (
    <SitePreview
      href="/dev/screens/site/landing"
      states={STATES}
      current={state}
      transparentHeader
      currentPath="/"
    >
      <LandingPage
        content={LANDING}
        services={SERVICES}
        featuredProducts={state === "no-products" ? [] : FEATURED_PRODUCTS}
        caseStudies={state === "no-proof" ? [] : CASE_STUDIES}
        testimonials={TESTIMONIALS}
        logos={CLIENT_LOGOS}
        blogTeasers={state === "no-proof" ? [] : BLOG_POSTS}
        serviceOptions={SERVICE_OPTIONS}
      />
    </SitePreview>
  );
}
