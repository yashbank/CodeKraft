import type { ReactNode } from "react";

/** Kitchen-sink section shell: anchor id, h2, description and a token-styled panel. */
export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 id={`${id}-title`} className="text-h2 text-fg">
          {title}
        </h2>
        {description ? (
          <p className="max-w-prose text-body-sm text-fg-muted">{description}</p>
        ) : null}
      </div>
      <div className="rounded-lg border border-border bg-surface p-6 shadow-1">{children}</div>
    </section>
  );
}

/** Labelled row inside a section (variant name on the left, samples on the right). */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0 md:grid-cols-[160px_1fr] md:items-center">
      <span className="text-overline font-semibold tracking-wider text-fg-muted uppercase">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
