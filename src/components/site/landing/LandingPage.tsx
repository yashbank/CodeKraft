import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { BlogTeaserCard } from "../BlogTeaserCard";
import { CaseStudyCard } from "../CaseStudyCard";
import { Container } from "../Container";
import { InquiryForm } from "../InquiryForm";
import { LogoStrip } from "../LogoStrip";
import { ProductCard } from "../ProductCard";
import { Reveal } from "../Reveal";
import { SectionHeading } from "../SectionHeading";
import { ServiceCard } from "../ServiceCard";
import { StatTile } from "../StatTile";
import { TestimonialCard } from "../TestimonialCard";
import type {
  BlogTeaser,
  CaseStudySummary,
  ClientLogo,
  LandingContent,
  ProductSummary,
  Service,
  ServiceOption,
  Testimonial,
} from "../types";
import { Chapter } from "./Chapter";
import { LandingHero } from "./LandingHero";
import { StoryRail } from "./StoryRail";

export interface LandingPageProps {
  content: LandingContent;
  services: Service[];
  featuredProducts: ProductSummary[];
  caseStudies: CaseStudySummary[];
  testimonials: Testimonial[];
  logos: ClientLogo[];
  blogTeasers: BlogTeaser[];
  serviceOptions: ServiceOption[];
}

const CHAPTERS = [
  { id: "who", label: "Who we are" },
  { id: "build", label: "What we build" },
  { id: "sell", label: "What we sell" },
  { id: "proof", label: "Proof" },
  { id: "talk", label: "Talk to us" },
];

/**
 * SCR-SITE-01 — five story chapters (D-801). Server component; the only client islands are the
 * hero CTA sheet, the rail, reveals and the chapter-5 form. Empty rules from the spec: no featured
 * products → "Products coming soon" band; no case studies → logos + testimonials only; no blogs →
 * teaser row omitted.
 */
export function LandingPage({
  content,
  services,
  featuredProducts,
  caseStudies,
  testimonials,
  logos,
  blogTeasers,
  serviceOptions,
}: LandingPageProps) {
  return (
    <>
      <StoryRail chapters={CHAPTERS} />
      <LandingHero content={content.who} logos={logos} serviceOptions={serviceOptions} />

      <Chapter
        id="build"
        eyebrow={content.build.eyebrow}
        title={content.build.title}
        body={content.build.body}
        layout="split"
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {services.map((s, i) => (
            <Reveal as="li" key={s.slug} delay={i}>
              <ServiceCard service={s} className="h-full" />
            </Reveal>
          ))}
        </ul>
        <Button asChild variant="link" className="mt-6">
          <Link href="/services">
            See all services <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
      </Chapter>

      <Chapter
        id="sell"
        eyebrow={content.sell.eyebrow}
        title={content.sell.title}
        body={content.sell.body}
        className="bg-[image:var(--ck-gradient-section)]"
      >
        {featuredProducts.length > 0 ? (
          <>
            <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 2xl:grid-cols-4">
              {featuredProducts.slice(0, 6).map((p, i) => (
                <Reveal
                  as="li"
                  key={p.id}
                  delay={i}
                  className="w-[82vw] shrink-0 snap-start sm:w-auto"
                >
                  <ProductCard product={p} className="h-full" />
                </Reveal>
              ))}
            </ul>
            <Button asChild variant="link" className="mt-6">
              <Link href="/products">
                Explore all products <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-h4">Products coming soon</p>
            <p className="mt-2 text-body-sm text-fg-muted">
              Meanwhile, tell us what you need built.
            </p>
            <Button asChild className="mt-6">
              <Link href="/contact">Start a project</Link>
            </Button>
          </div>
        )}
      </Chapter>

      <Chapter
        id="proof"
        eyebrow={content.proof.eyebrow}
        title={content.proof.title}
        body={content.proof.body}
      >
        <div className="space-y-12">
          <Reveal>
            <LogoStrip logos={logos} />
          </Reveal>
          {content.proof.stats.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {content.proof.stats.map((s, i) => (
                <Reveal key={s.label} delay={i}>
                  <StatTile label={s.label} value={s.value} />
                </Reveal>
              ))}
            </div>
          ) : null}
          {caseStudies.length > 0 ? (
            <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {caseStudies.slice(0, 3).map((c, i) => (
                <Reveal
                  as="li"
                  key={c.slug}
                  delay={i}
                  className="w-[82vw] shrink-0 snap-start sm:w-auto"
                >
                  <CaseStudyCard study={c} className="h-full" />
                </Reveal>
              ))}
            </ul>
          ) : null}
          {testimonials.length > 0 ? (
            <ul className="grid gap-4 md:grid-cols-3">
              {testimonials.slice(0, 3).map((t, i) => (
                <Reveal as="li" key={t.id} delay={i}>
                  <TestimonialCard testimonial={t} />
                </Reveal>
              ))}
            </ul>
          ) : null}
        </div>
      </Chapter>

      <Chapter
        id="talk"
        eyebrow={content.talk.eyebrow}
        title={content.talk.title}
        body={content.talk.body}
        layout="split"
      >
        <Reveal className="rounded-xl border border-border bg-surface p-6 shadow-1 lg:p-8">
          <InquiryForm variant="compact" serviceOptions={serviceOptions} />
          <div className="mt-4 border-t border-border pt-4">
            <Button asChild variant="link">
              <Link href="/products">
                Explore products <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
        </Reveal>
      </Chapter>

      {blogTeasers.length > 0 ? (
        <section aria-labelledby="from-the-blog" className="border-t border-border py-16 lg:py-24">
          <Container>
            <SectionHeading
              id="from-the-blog"
              eyebrow="From the blog"
              title="Deep dives into the products we build"
              action={
                <Button asChild variant="link">
                  <Link href="/blog">
                    All articles <ArrowRightIcon aria-hidden />
                  </Link>
                </Button>
              }
            />
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {blogTeasers.slice(0, 3).map((b, i) => (
                <Reveal as="li" key={b.slug} delay={i}>
                  <BlogTeaserCard post={b} className="h-full" />
                </Reveal>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}
    </>
  );
}
