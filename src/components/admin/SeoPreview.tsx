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
          <p
            className="break-words text-body font-medium text-accent"
            data-testid="seo-preview-title"
          >
            {s.title}
          </p>
          <p className="break-words text-body-sm text-fg-muted">{s.description}</p>
        </div>
        <div className="min-w-0 overflow-hidden rounded-md border border-border bg-canvas">
          {/* The real share image lives on the public host (cross-origin, and dynamic routes carry a
              hashed path), so fetching it from admin is blocked (ORB). Draw a same-origin stand-in. */}
          <div
            role="img"
            aria-label="Social share card (preview)"
            className="grid aspect-[1200/630] w-full place-items-center bg-surface p-4 text-center"
          >
            <span className="line-clamp-3 text-h4 font-semibold text-fg-muted">{s.title}</span>
          </div>
          <div className="p-3">
            <p className="break-words text-body-sm font-semibold">{s.title}</p>
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
