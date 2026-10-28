"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { formatDate } from "../_format";
import { RichText } from "../RichText";
import { TestimonialCard } from "../TestimonialCard";
import type { ProductDetail } from "../types";

interface TabDef {
  id: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Product detail tabs (docs/08 §6.11): Overview · Features · Testimonials · FAQs · Changelog ·
 * Presentation. Tabs at md+; the same panels render as an `Accordion` with h2 headings on phones.
 * Empty sections are omitted. The blog is not a tab (teaser card below, D-804).
 */
export function ProductTabs({ product }: { product: ProductDetail }) {
  const p = product;
  const tabs: TabDef[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="space-y-8">
          <RichText html={p.descriptionHtml} />
          {p.benefits.length > 0 ? <ListBlock title="Benefits" items={p.benefits} /> : null}
          <div className="grid gap-8 md:grid-cols-2">
            {p.targetAudience.length > 0 ? (
              <ListBlock title="Who it's for" items={p.targetAudience} />
            ) : null}
            {p.useCases.length > 0 ? <ListBlock title="Use cases" items={p.useCases} /> : null}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {p.industries.length > 0 ? <ChipBlock title="Industries" items={p.industries} /> : null}
            {p.techStack.length > 0 ? <ChipBlock title="Tech stack" items={p.techStack} /> : null}
          </div>
          {p.requirements.length > 0 ? (
            <ListBlock title="Requirements" items={p.requirements} />
          ) : null}
        </div>
      ),
    },
  ];
  if (p.features.length > 0) {
    tabs.push({
      id: "features",
      label: "Features",
      content: (
        <ul className="grid gap-3 md:grid-cols-2">
          {p.features.map((f) => (
            <li
              key={f}
              className="rounded-md border border-border bg-surface px-4 py-3 text-body text-fg"
            >
              {f}
            </li>
          ))}
        </ul>
      ),
    });
  }
  if (p.testimonials.length > 0) {
    tabs.push({
      id: "testimonials",
      label: "Testimonials",
      content: (
        <ul className="grid gap-4 md:grid-cols-2">
          {p.testimonials.map((t) => (
            <li key={t.id}>
              <TestimonialCard testimonial={t} />
            </li>
          ))}
        </ul>
      ),
    });
  }
  if (p.faqs.length > 0) {
    tabs.push({
      id: "faqs",
      label: "FAQs",
      content: (
        <Accordion
          type="single"
          collapsible
          className="rounded-lg border border-border bg-surface px-5"
        >
          {p.faqs.map((f) => (
            <AccordionItem key={f.id} value={f.id}>
              <AccordionTrigger>{f.question}</AccordionTrigger>
              <AccordionContent className="text-body">{f.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ),
    });
  }
  if (p.changelog.length > 0) {
    tabs.push({
      id: "changelog",
      label: "Changelog",
      content: (
        <ol className="space-y-6">
          {p.changelog.map((c, i) => (
            <li
              key={c.version}
              className="grid gap-2 border-l-2 border-border pl-5 sm:grid-cols-[160px_1fr] sm:gap-6"
            >
              <div className="flex items-center gap-2 sm:flex-col sm:items-start">
                <Badge tone={i === 0 ? "accent" : "neutral"}>v{c.version}</Badge>
                <time dateTime={c.date} className="text-caption text-fg-muted">
                  {formatDate(c.date)}
                </time>
              </div>
              <RichText html={c.notesHtml} size="md" />
            </li>
          ))}
        </ol>
      ),
    });
  }
  if (p.hasPresentation) {
    tabs.push({
      id: "presentation",
      label: "Presentation",
      content: (
        <PresentationViewer title={`${p.name} overview deck`} mediaId={p.presentationMediaId} />
      ),
    });
  }

  return (
    <>
      <Tabs defaultValue="overview" className="hidden md:flex">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="flex-none">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.id} value={t.id} className="pt-8">
            <h2 className="sr-only">{t.label}</h2>
            {t.content}
          </TabsContent>
        ))}
      </Tabs>
      <Accordion type="multiple" defaultValue={["overview"]} className="md:hidden">
        {tabs.map((t) => (
          <AccordionItem key={t.id} value={t.id}>
            <AccordionTrigger className="text-h4">{t.label}</AccordionTrigger>
            <AccordionContent className="text-body text-fg">{t.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-h4">{title}</h3>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-body text-fg-muted">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function ChipBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-overline tracking-wider text-fg-muted uppercase">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {items.map((i) => (
          <li key={i}>
            <Badge tone="ghost">{i}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Inline PDF preview via the browser's native viewer; "Open PDF" is the fallback. */
export function PresentationViewer({ title, mediaId }: { title: string; mediaId?: string }) {
  const src = mediaId ? `/api/files/product-media/${mediaId}` : undefined;
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-surface">
      {src ? (
        <iframe
          src={src}
          title={title}
          data-testid="pdf-preview"
          className="aspect-[16/9] w-full bg-elevated"
        />
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center bg-elevated text-body-sm text-fg-muted">
          Preview unavailable
        </div>
      )}
      {src ? (
        <figcaption className="flex items-center border-t border-border p-3">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-body-sm font-medium text-accent hover:underline"
          >
            Open PDF
          </a>
        </figcaption>
      ) : null}
    </figure>
  );
}
