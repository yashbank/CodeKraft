import type { Metadata } from "next";

import { anonymousContext } from "@/lib/authz/context";
import { toneFromSlug } from "@/lib/media-tone";
import { toServiceIcon } from "@/lib/service-icon";
import {
  getLandingContentQuery,
  listCaseStudiesQuery,
  listClientLogosQuery,
  listServicesQuery,
  listTestimonialsQuery,
} from "@/modules/content/queries";
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
  const [landingResult, logosResult, testimonialsResult, caseStudiesResult, servicesResult] =
    await Promise.all([
      getLandingContentQuery({}, ctx),
      listClientLogosQuery({}, ctx),
      listTestimonialsQuery({ context: "site" }, ctx),
      listCaseStudiesQuery({ limit: 3 }, ctx),
      listServicesQuery({}, ctx),
    ]);

  const chaptersByKey = new Map(
    landingResult.ok ? landingResult.data.chapters.map((c) => [c.key, c]) : [],
  );

  const who = chapterCopy(chaptersByKey.get("who"));
  const proof = chapterCopy(chaptersByKey.get("proof"));

  const content: LandingContent = {
    who: { ...who, subtitle: chaptersByKey.get("who")?.subtitle ?? "" },
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

  // No public "browse all products" query yet (catalog module only exposes single-product and
  // category lookups) — an empty list is the component's own documented empty state ("Products
  // coming soon" band), not a placeholder hack. Same for blog teasers below.
  const featuredProducts: ProductSummary[] = [];
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
