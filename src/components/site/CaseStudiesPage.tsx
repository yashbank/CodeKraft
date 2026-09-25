"use client";

import { FolderOpenIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/_utils";

import { CaseStudyCard, CaseStudyCardSkeleton } from "./CaseStudyCard";
import { Container } from "./Container";
import { EmptyState } from "./EmptyState";
import { InquiryTrigger } from "./InquiryTrigger";
import { LogoStrip } from "./LogoStrip";
import type { CaseStudySummary, ClientLogo, ServiceOption } from "./types";

export interface CaseStudiesPageProps {
  studies: CaseStudySummary[];
  logos: ClientLogo[];
  serviceOptions: ServiceOption[];
  intro?: string;
  loading?: boolean;
}

/**
 * SCR-SITE-05 — hero band, industry + tech chip filters (toggle buttons with `aria-pressed`,
 * client-side; P7 mirrors to `?industry=&tech=`), 3-up grid (4-up at 2xl), live-region count,
 * logo strip above the footer. Empty: hero + inquiry CTA + logos.
 */
export function CaseStudiesPage({
  studies,
  logos,
  serviceOptions,
  intro,
  loading = false,
}: CaseStudiesPageProps) {
  const [industry, setIndustry] = useState<string | null>(null);
  const [tech, setTech] = useState<string | null>(null);
  const industries = useMemo(() => [...new Set(studies.map((s) => s.industry))].sort(), [studies]);
  const techs = useMemo(() => [...new Set(studies.flatMap((s) => s.techStack))].sort(), [studies]);
  const shown = studies
    .filter((s) => (industry ? s.industry === industry : true))
    .filter((s) => (tech ? s.techStack.includes(tech) : true))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return (
    <>
      <section
        aria-labelledby="projects-title"
        className="relative overflow-hidden border-b border-border"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[image:var(--ck-gradient-glow)] opacity-50"
        />
        <Container className="relative space-y-6 py-16 lg:py-24">
          <p className="text-overline font-semibold tracking-wider text-accent-text uppercase">
            Projects
          </p>
          <h1 id="projects-title" className="font-display text-display-lg text-balance">
            Work our clients put their name to
          </h1>
          <p className="max-w-[55ch] text-body-lg text-fg-muted">
            {intro ?? "Case studies with numbers, not adjectives."}
          </p>
          <InquiryTrigger size="xl" className="w-full sm:w-auto" sheet={{ serviceOptions }}>
            Start a project
          </InquiryTrigger>
        </Container>
      </section>

      <Container className="py-10 lg:py-14">
        {studies.length === 0 && !loading ? (
          <EmptyState
            icon={FolderOpenIcon}
            title="Case studies are being written"
            body="Meanwhile, tell us about your project."
            actions={<InquiryTrigger sheet={{ serviceOptions }}>Start a project</InquiryTrigger>}
          />
        ) : (
          <>
            <div className="space-y-3">
              <ChipRow
                label="Industry"
                options={industries}
                value={industry}
                onChange={setIndustry}
              />
              <ChipRow label="Tech" options={techs} value={tech} onChange={setTech} />
            </div>
            <p aria-live="polite" className="mt-4 text-body-sm text-fg-muted">
              {loading
                ? "Loading projects…"
                : `${String(shown.length)} ${shown.length === 1 ? "project" : "projects"} shown`}
            </p>
            {loading ? (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i}>
                    <CaseStudyCardSkeleton />
                  </li>
                ))}
              </ul>
            ) : shown.length === 0 ? (
              <EmptyState
                icon={FolderOpenIcon}
                title="No projects match these filters"
                actions={
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setIndustry(null);
                      setTech(null);
                    }}
                  >
                    Clear filters
                  </Button>
                }
                className="mt-6"
              />
            ) : (
              <ul className="ck-crossfade mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {shown.map((s) => (
                  <li key={s.slug}>
                    <CaseStudyCard study={s} className="h-full" />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Container>

      {logos.length > 0 ? (
        <Container className="border-t border-border py-12">
          <LogoStrip logos={logos} />
        </Container>
      ) : null}
    </>
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0"
    >
      <span className="shrink-0 text-caption text-fg-muted">{label}</span>
      <Chip active={value === null} onClick={() => onChange(null)}>
        All
      </Chip>
      {options.map((o) => (
        <Chip key={o} active={value === o} onClick={() => onChange(value === o ? null : o)}>
          {o}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full border px-3.5 text-body-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-accent bg-accent-soft text-accent-text"
          : "border-border bg-surface text-fg-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
