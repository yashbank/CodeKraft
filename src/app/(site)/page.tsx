import type { Metadata } from "next";

import { anonymousContext } from "@/lib/authz/context";
import { toneFromSlug } from "@/lib/media-tone";
import { toServiceIcon } from "@/lib/service-icon";
import { toProductSummary } from "@/lib/product-summary";
import {
  getLandingContentQuery,
  listCaseStudiesQuery,
  listClientLogosQuery,
  listServicesQuery,
  listTestimonialsQuery,
} from "@/modules/content/queries";
import { listFeaturedProductsQuery } from "@/modules/catalog/queries";
import { LandingPage } from "@/components/site/landing/LandingPage";
import type {
  BlogTeaser,
  CaseStudySummary,
  ClientLogo,
  LandingContent,
  ProductSummary,
  Service,
  ServiceOption,
  Testimonial,
} from "@/components/site/types";
import type { LandingChapterView } from "@/modules/content/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CodeKraft — Architected for scale. Crafted for production.",
  description:
    "We design and build bespoke software architectures, digital products, and robust enterprise solutions.",
};

function chapterCopy(c: LandingChapterView | undefined) {
  return { eyebrow: c?.eyebrow ?? "", title: c?.title ?? "", body: c?.plainBody ?? "" };
}

export default async function LandingRoute() {
  const ctx = anonymousContext();
  const [
    landingResult,
    logosResult,
    testimonialsResult,
    caseStudiesResult,
    servicesResult,
    featuredProductsResult,
  ] = await Promise.all([
    getLandingContentQuery({}, ctx),
    listClientLogosQuery({}, ctx),
    listTestimonialsQuery({ context: "site" }, ctx),
    listCaseStudiesQuery({ limit: 3 }, ctx),
    listServicesQuery({}, ctx),
    listFeaturedProductsQuery({ limit: 8, displayCurrency: "INR" }, ctx),
  ]);

  const chaptersByKey = new Map(
    landingResult.ok ? landingResult.data.chapters.map((c) => [c.key, c]) : [],
  );

  const whoChapter = chaptersByKey.get("who");
  const who = chapterCopy(whoChapter);
  const proof = chapterCopy(chaptersByKey.get("proof"));

  const content: LandingContent = {
    who: {
      ...who,
      subtitle: whoChapter?.subtitle ?? "",
      poster: whoChapter?.media.poster
        ? { url: whoChapter.media.poster.url, alt: whoChapter.media.poster.alt || whoChapter.title }
        : null,
    },
    build: chapterCopy(chaptersByKey.get("build")),
    sell: chapterCopy(chaptersByKey.get("sell")),
    proof: { ...proof, stats: [] },
    talk: chapterCopy(chaptersByKey.get("talk")),
  };

  const serviceRows = servicesResult.ok ? servicesResult.data : [];
  const services: Service[] = serviceRows.map((s) => ({
    slug: s.slug,
    title: s.title,
    summary: s.summary ?? "",
    icon: toServiceIcon(s.icon),
    deliverables: s.deliverables,
    bodyHtml: s.html,
  }));
  const serviceOptions: ServiceOption[] = services.map((s) => ({ slug: s.slug, title: s.title }));

  const caseStudyRows = caseStudiesResult.ok ? caseStudiesResult.data.items : [];
  const caseStudies: CaseStudySummary[] = caseStudyRows.map((c) => ({
    slug: c.slug,
    title: c.title,
    client: c.clientName ?? undefined,
    industry: c.industry ?? "",
    techStack: c.techStack,
    resultHighlight: c.resultHighlight ?? "",
    publishedAt: c.publishedAt ?? "",
    coverAlt: c.cover?.alt ?? c.title,
    coverTone: toneFromSlug(c.slug),
  }));

  const testimonialRows = testimonialsResult.ok ? testimonialsResult.data : [];
  const testimonials: Testimonial[] = testimonialRows.map((t) => ({
    id: t.id,
    quote: t.quote,
    author: t.authorName,
    role: t.authorTitle ?? "",
    company: t.company ?? "",
  }));

  const logoRows = logosResult.ok ? logosResult.data : [];
  const logos: ClientLogo[] = logoRows.map((l) => ({ id: l.id, name: l.name }));

  const featuredProducts: ProductSummary[] = featuredProductsResult.ok
    ? featuredProductsResult.data.map(toProductSummary)
    : [];
  // Blog module isn't wired to the database yet — an empty list is the component's own
  // documented empty state, not a placeholder hack.
  const blogTeasers: BlogTeaser[] = [];

  return (
    <LandingPage
      content={content}
      services={services}
      featuredProducts={featuredProducts}
      caseStudies={caseStudies}
      testimonials={testimonials}
      logos={logos}
      blogTeasers={blogTeasers}
      serviceOptions={serviceOptions}
    />
  );
}
