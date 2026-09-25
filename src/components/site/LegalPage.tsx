import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/_utils";

import { formatDate } from "./_format";
import { Container } from "./Container";
import { RichText } from "./RichText";
import { TableOfContents } from "./TableOfContents";
import type { LegalKey, LegalPageView } from "./types";

export interface LegalPageProps {
  page: LegalPageView;
  /** The four legal keys for the secondary nav. */
  nav: { key: LegalKey; title: string }[];
}

/**
 * SCR-SITE-10 — breadcrumb, h1 + "Version n · Last updated", tabs-as-links switcher (chips on
 * phone), sticky TOC 260 px (Accordion "Contents" on phone), 760 px body of numbered sections,
 * "Questions? Sign in and open a query" (no email, D-808) and the governing-law line (D-1504).
 */
export function LegalPage({ page, nav }: LegalPageProps) {
  const toc = page.sections.map((s) => ({ id: s.id, label: s.title }));
  return (
    <Container className="py-8 lg:py-12 print:py-0">
      <Breadcrumb className="print:hidden">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/legal/privacy">Legal</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{page.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <header className="mt-6 space-y-3">
        <h1 className="font-display text-display-lg">{page.title}</h1>
        <p className="text-body-sm text-fg-muted">
          Version {page.version} · Last updated{" "}
          <time dateTime={page.updatedAt}>{formatDate(page.updatedAt)}</time>
        </p>
        <nav
          aria-label="Legal pages"
          className="-mx-4 overflow-x-auto px-4 pt-2 [scrollbar-width:none] print:hidden md:mx-0 md:px-0"
        >
          <ul className="flex gap-2 md:gap-4 md:border-b md:border-border">
            {nav.map((n) => {
              const active = n.key === page.key;
              return (
                <li key={n.key} className="shrink-0">
                  <Link
                    href={`/legal/${n.key}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-full border px-3.5 text-body-sm leading-9 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:relative md:rounded-none md:border-0 md:px-1 md:leading-10 md:after:absolute md:after:inset-x-0 md:after:-bottom-px md:after:h-0.5 md:after:bg-accent",
                      active
                        ? "border-accent bg-accent-soft text-accent-text md:bg-transparent md:text-fg md:after:opacity-100"
                        : "border-border bg-surface text-fg-muted hover:text-fg md:bg-transparent md:after:opacity-0",
                    )}
                  >
                    {n.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <div className="mt-8 lg:grid lg:grid-cols-[260px_minmax(0,760px)] lg:gap-16 tv:grid-cols-[260px_minmax(0,880px)]">
        <div className="print:hidden">
          <Accordion
            type="single"
            collapsible
            className="rounded-lg border border-border bg-surface px-4 lg:hidden"
          >
            <AccordionItem value="toc" className="border-0">
              <AccordionTrigger>Contents</AccordionTrigger>
              <AccordionContent>
                <TableOfContents items={toc} label="Contents" />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <div className="hidden lg:sticky lg:top-24 lg:block">
            <p className="mb-3 text-overline tracking-wider text-fg-muted uppercase">Contents</p>
            <TableOfContents items={toc} label="Contents" />
          </div>
        </div>
        <div className="mt-8 lg:mt-0">
          {page.sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              aria-labelledby={`${s.id}-h`}
              className="scroll-mt-24 border-b border-border py-8 first:pt-0 last:border-0"
            >
              <h2 id={`${s.id}-h`} className="text-h2">
                {s.title}
              </h2>
              <RichText html={s.bodyHtml} size="md" className="mt-4" />
            </section>
          ))}
          <div className="mt-10 space-y-4 rounded-lg border border-border bg-surface p-5 print:hidden">
            <p className="text-body font-semibold">Questions?</p>
            <p className="text-body-sm text-fg-muted">
              Sign in and open a query — we answer there, not by email.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link href="/account/queries?new=1">Open a query</Link>
            </Button>
          </div>
          <p className="mt-8 text-caption text-fg-subtle">
            These terms are governed by the laws of India.
          </p>
        </div>
      </div>
    </Container>
  );
}
