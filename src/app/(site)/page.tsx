import type { Metadata } from "next";

import { safeCta } from "@/components/admin/content/cta-targets";

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
import { listBlogTeasersQuery } from "@/modules/blog/queries";
import { toBlogTeaser } from "@/lib/blog-view";
import { LandingPage } from "@/components/site/landing/LandingPage";
import type {
  BlogTeaser,
  CaseStudySummary,
  ClientLogo,
  FaqItem,
  LandingContent,
  ProductSummary,
  Service,
  ServiceOption,
  Testimonial,
} from "@/components/site/types";
import { toPlainText } from "@/modules/content/render";
import type { LandingChapterView } from "@/modules/content/types";
import type { RichTextDoc } from "@/modules/_shared/zod";
import { getSiteName } from "@/lib/site-brand";

// ISR (docs/08 §10). Anonymous data only. Every admin save that changes homepage content
// calls revalidatePath("/", "layout") (content, catalog, settings admin wrappers), so edits show
// on the next request. The window is a fallback for writes that run outside a request
// (scheduled publish job) and for anything that is not wired to a path revalidation.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  return {
    title: { absolute: `${siteName} — Architected for scale. Crafted for production.` },
    description:
      "We design and build bespoke software architectures, digital products, and robust enterprise solutions.",
  };
}

function chapterCopy(c: LandingChapterView | undefined) {
  return {
    eyebrow: c?.eyebrow ?? "",
    title: c?.title ?? "",
    body: c?.plainBody ?? "",
    cta: safeCta(c?.cta),
  };
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
    blogTeasersResult,
  ] = await Promise.all([
    getLandingContentQuery({}, ctx),
    listClientLogosQuery({}, ctx),
    listTestimonialsQuery({ context: "site" }, ctx),
    listCaseStudiesQuery({ limit: 3 }, ctx),
    listServicesQuery({}, ctx),
    listFeaturedProductsQuery({ limit: 8, displayCurrency: "INR" }, ctx),
    listBlogTeasersQuery({ limit: 3 }, ctx),
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
    coverUrl: c.cover?.url || undefined,
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
  const logos: ClientLogo[] = logoRows.map((l) => ({
    id: l.id,
    name: l.name,
    logoUrl: l.logo.url || undefined,
    href: l.url ?? undefined,
  }));

  const featuredProducts: ProductSummary[] = featuredProductsResult.ok
    ? featuredProductsResult.data.map(toProductSummary)
    : [];
  // Empty list hides the "From the blog" band (LandingPage renders it only when non-empty).
  const blogTeasers: BlogTeaser[] = blogTeasersResult.ok
    ? blogTeasersResult.data.map(toBlogTeaser)
    : [];

  const faqRows = landingResult.ok ? landingResult.data.faqs : [];
  const faqs: FaqItem[] = faqRows.map((f) => ({
    id: f.id,
    question: f.question,
    answer: toPlainText(f.answer as unknown as RichTextDoc),
  }));

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
      faqs={faqs}
    />
  );
}
