"use client";

import { useSiteName } from "@/components/brand/site-brand";
import { pageMetadata, seoSnippet, type PageMetaInput } from "@/lib/seo";

/** R9-12 — Google snippet + share card, built by the same `pageMetadata` the public page uses. */
export function SeoPreview({ input }: { input: PageMetaInput }) {
  const siteName = useSiteName();
  const s = seoSnippet(pageMetadata(input), siteName);
  return (
    <section aria-label="SEO preview" data-testid="seo-preview" className="space-y-3">
      <p className="text-body-sm font-semibold">SEO preview</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 rounded-md border border-border bg-canvas p-3">
          <p className="truncate text-caption text-fg-subtle" data-testid="seo-preview-url">
            {s.url}
          </p>
          <p className="text-body font-medium text-accent" data-testid="seo-preview-title">
            {s.title}
          </p>
          <p className="break-words text-body-sm text-fg-muted">{s.description}</p>
        </div>
        <div className="min-w-0 overflow-hidden rounded-md border border-border bg-canvas">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote share image, not optimised */}
          <img
            src={s.image}
            alt="Social share card"
            className="aspect-[1200/630] w-full bg-surface object-cover"
          />
          <div className="p-3">
            <p className="text-body-sm font-semibold">{s.title}</p>
            <p className="line-clamp-2 text-caption text-fg-muted">{s.description}</p>
          </div>
        </div>
      </div>
      {s.warnings.map((w) => (
        <p key={w} role="alert" className="text-caption text-warning">
          {w}
        </p>
      ))}
    </section>
  );
}
