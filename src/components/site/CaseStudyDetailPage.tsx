import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Container } from "./Container";
import { CtaBand } from "./CtaBand";
import { InquiryTrigger } from "./InquiryTrigger";
import { MediaPlaceholder } from "./MediaPlaceholder";
import { PrevNextNav, type PrevNextItem } from "./PrevNextNav";
import { Reveal } from "./Reveal";
import { RichText } from "./RichText";
import { StatTile } from "./StatTile";
import type { CaseStudy, ServiceOption } from "./types";

export interface CaseStudyDetailPageProps {
  study: CaseStudy;
  serviceOptions: ServiceOption[];
  prev?: PrevNextItem;
  next?: PrevNextItem;
}

/**
 * SCR-SITE-06 — breadcrumb, header (industry chip, h1, client line, tech chips), 21:9 cover,
 * 720 px article with sticky "At a glance" rail (stat tiles + "Start a similar project"), sections
 * Problem / Solution / Results / Gallery (lightbox `Dialog`), prev/next, inquiry band.
 */
export function CaseStudyDetailPage({
  study,
  serviceOptions,
  prev,
  next,
}: CaseStudyDetailPageProps) {
  const s = study;
  const clientLine = s.client ? `for ${s.client}` : "for a confidential client";
  const sheet = {
    serviceOptions,
    title: "Start a similar project",
    defaults: { message: `I'm interested in something like "${s.title}". ` },
  };
  const glance = (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-overline tracking-wider text-fg-muted uppercase">At a glance</h2>
      <dl className="space-y-2 text-body-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-fg-muted">Industry</dt>
          <dd className="text-fg">{s.industry}</dd>
        </div>
        {s.timeline ? (
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">Timeline</dt>
            <dd className="text-fg">{s.timeline}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-fg-muted">Stack</dt>
          <dd className="text-right text-fg">{s.techStack.join(", ")}</dd>
        </div>
      </dl>
      {s.metrics.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {s.metrics.slice(0, 3).map((m) => (
            <StatTile key={m.label} label={m.label} value={m.value} className="px-4 py-3" />
          ))}
        </div>
      ) : null}
      <InquiryTrigger className="w-full" sheet={sheet}>
        Start a similar project
      </InquiryTrigger>
    </div>
  );

  return (
    <article>
      <Container className="pt-6 lg:pt-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/projects">Projects</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{s.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <header className="mt-8 max-w-3xl space-y-4">
          <Badge tone="neutral">{s.industry}</Badge>
          <h1 className="font-display text-display-lg text-balance">{s.title}</h1>
          <p className="text-body-lg text-fg-muted">{clientLine}</p>
          <ul aria-label="Tech stack" className="flex flex-wrap gap-1.5">
            {s.techStack.map((t) => (
              <li key={t}>
                <Badge tone="ghost">{t}</Badge>
              </li>
            ))}
          </ul>
        </header>
        <MediaPlaceholder
          alt={s.coverAlt}
          tone={s.coverTone}
          ratio="21/9"
          className="mt-10 rounded-2xl 2xl:max-h-[720px]"
        />
      </Container>

      <Container className="mt-10 lg:mt-16 lg:grid lg:grid-cols-[minmax(0,720px)_280px] lg:justify-between lg:gap-12 2xl:grid-cols-[minmax(0,840px)_300px]">
        <div className="lg:hidden">{glance}</div>
        <div className="mt-10 space-y-14 lg:mt-0">
          <Section id="problem" title="Problem" html={s.problemHtml} />
          <Section id="solution" title="Solution" html={s.solutionHtml} />
          <section aria-labelledby="results" className="space-y-5">
            <h2 id="results" className="text-h2">
              Results
            </h2>
            {s.metrics.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {s.metrics.map((m, i) => (
                  <Reveal key={m.label} delay={i}>
                    <StatTile label={m.label} value={m.value} />
                  </Reveal>
                ))}
              </div>
            ) : null}
            <RichText html={s.resultsHtml} />
          </section>
          {s.gallery.length > 0 ? (
            <section aria-labelledby="gallery" className="space-y-5">
              <h2 id="gallery" className="text-h2">
                Gallery
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {s.gallery.map((g, i) => (
                  <Reveal as="li" key={g.id} delay={i}>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          aria-label={`Open image: ${g.alt}`}
                        >
                          <MediaPlaceholder alt="" kind="gallery" tone={i + 2} ratio="3/2" />
                        </button>
                      </DialogTrigger>
                      <DialogContent size="lg" className="p-4">
                        <DialogTitle className="sr-only">{g.alt}</DialogTitle>
                        <DialogDescription className="sr-only">
                          {g.caption ?? g.alt}
                        </DialogDescription>
                        <MediaPlaceholder alt={g.alt} kind="gallery" tone={i + 2} ratio="3/2" />
                        {g.caption ? (
                          <p className="text-body-sm text-fg-muted">{g.caption}</p>
                        ) : null}
                      </DialogContent>
                    </Dialog>
                    {g.caption ? (
                      <p className="mt-2 text-caption text-fg-muted">{g.caption}</p>
                    ) : null}
                  </Reveal>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <aside aria-label="At a glance" className="hidden lg:block">
          <div className="sticky top-24">{glance}</div>
        </aside>
      </Container>

      {prev || next ? (
        <Container className="mt-16">
          <PrevNextNav prev={prev} next={next} label="Adjacent projects" />
        </Container>
      ) : null}

      <CtaBand
        title="Have something similar in mind?"
        body="Tell us what you're building. We reply by email within 2 working days."
        actions={
          <InquiryTrigger size="lg" sheet={sheet}>
            Start a similar project
          </InquiryTrigger>
        }
      />
    </article>
  );
}

function Section({ id, title, html }: { id: string; title: string; html: string }) {
  return (
    <section aria-labelledby={id} className="space-y-5">
      <h2 id={id} className="text-h2">
        {title}
      </h2>
      <RichText html={html} />
    </section>
  );
}
