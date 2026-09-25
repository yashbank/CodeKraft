import { CheckIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { Container } from "./Container";
import { CtaBand } from "./CtaBand";
import { InquiryTrigger } from "./InquiryTrigger";
import { Reveal } from "./Reveal";
import { RichText } from "./RichText";
import { ServiceIcon } from "./ServiceIcon";
import { TableOfContents } from "./TableOfContents";
import type { Service, ServiceOption } from "./types";

export interface ServicesPageProps {
  services: Service[];
  serviceOptions: ServiceOption[];
  /** `site_settings.services_intro` */
  intro?: string;
}

/**
 * SCR-SITE-02 — hero band, sticky "On this page" TOC (chips on phone), one section per service
 * (icon, h2, summary, deliverables checklist, body, "Discuss this service" → InquirySheet with
 * `service_interest` pre-selected), closing band. No prices anywhere (BR-01).
 */
export function ServicesPage({ services, serviceOptions, intro }: ServicesPageProps) {
  const toc = services.map((s) => ({ id: s.slug, label: s.title }));
  return (
    <>
      <section
        aria-labelledby="services-title"
        className="relative overflow-hidden border-b border-border"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[image:var(--ck-gradient-glow)] opacity-50"
        />
        <Container className="relative space-y-6 py-16 lg:py-24">
          <p className="text-overline font-semibold tracking-wider text-accent-text uppercase">
            Services
          </p>
          <h1 id="services-title" className="font-display text-display-lg text-balance">
            What we build
          </h1>
          <p className="max-w-[55ch] text-body-lg text-fg-muted">
            {intro ??
              "Fixed-scope engagements for web, mobile, SaaS and AI — designed, built and handed over with the documentation to run them."}
          </p>
          <InquiryTrigger size="xl" className="w-full sm:w-auto" sheet={{ serviceOptions }}>
            Start a project
          </InquiryTrigger>
        </Container>
      </section>

      {services.length === 0 ? (
        <CtaBand
          title="Tell us what you need"
          body="Our service list is being updated. Describe your project and we'll scope it with you."
          actions={
            <InquiryTrigger size="lg" sheet={{ serviceOptions }}>
              Start a project
            </InquiryTrigger>
          }
        />
      ) : (
        <Container className="py-8 lg:grid lg:grid-cols-[240px_1fr] lg:gap-16 lg:py-16">
          <div className="sticky top-14 z-(--ck-z-raised) -mx-4 border-b border-border bg-canvas/90 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <div className="lg:sticky lg:top-28">
              <p className="mb-3 hidden text-overline tracking-wider text-fg-muted uppercase lg:block">
                On this page
              </p>
              <TableOfContents
                items={toc}
                label="On this page"
                variant="chips"
                className="lg:hidden"
              />
              <TableOfContents
                items={toc}
                label="On this page"
                variant="list"
                className="hidden lg:block"
              />
            </div>
          </div>

          <div className="divide-y divide-border">
            {services.map((s) => (
              <Reveal
                as="section"
                key={s.slug}
                id={s.slug}
                aria-labelledby={`${s.slug}-title`}
                className="scroll-mt-32 py-12 lg:py-24"
              >
                <div className="rounded-xl border border-border bg-surface p-6 shadow-1 lg:p-10">
                  <div className="flex items-start gap-4">
                    <ServiceIcon name={s.icon} />
                    <div className="space-y-2">
                      <h2 id={`${s.slug}-title`} className="text-h2">
                        {s.title}
                      </h2>
                      <p className="max-w-[60ch] text-body-lg text-fg-muted">{s.summary}</p>
                    </div>
                  </div>
                  <h3 className="mt-8 text-overline tracking-wider text-fg-muted uppercase">
                    Deliverables
                  </h3>
                  <ul className="mt-3 grid gap-2 md:grid-cols-2">
                    {s.deliverables.map((d) => (
                      <li key={d} className="flex items-start gap-2.5 text-body text-fg">
                        <CheckIcon aria-hidden className="mt-1 size-4 shrink-0 text-success" />
                        {d}
                      </li>
                    ))}
                  </ul>
                  {s.bodyHtml ? <RichText html={s.bodyHtml} size="md" className="mt-6" /> : null}
                  <div className="mt-8">
                    <InquiryTrigger
                      variant="secondary"
                      className="w-full sm:w-auto"
                      sheet={{
                        serviceOptions,
                        defaults: { serviceInterest: s.slug },
                        title: `Discuss ${s.title.toLowerCase()}`,
                      }}
                    >
                      Discuss this service
                    </InquiryTrigger>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      )}

      <CtaBand
        title="Not sure what you need?"
        body="Describe the outcome you want. We'll suggest the smallest thing that gets you there."
        actions={
          <>
            <InquiryTrigger size="lg" sheet={{ serviceOptions }}>
              Start a project
            </InquiryTrigger>
            <Button asChild variant="secondary" size="lg">
              <Link href="/projects">See our work</Link>
            </Button>
          </>
        }
      />
    </>
  );
}
