import type { ReactNode } from "react";

import { cn } from "@/components/ui/_utils";

import { Container } from "./Container";

/** Full-width closing band ("Not sure what you need?", "Request customisation", …). */
export function CtaBand({
  title,
  body,
  actions,
  className,
}: {
  title: string;
  body?: string;
  actions: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn("py-16 lg:py-24", className)}>
      <Container>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-6 py-12 text-center shadow-glow-soft sm:px-12 lg:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[image:var(--ck-gradient-glow)] opacity-70"
          />
          <div className="relative mx-auto max-w-2xl space-y-4">
            <h2 className="font-display text-h2 text-balance">{title}</h2>
            {body ? <p className="text-body-lg text-fg-muted">{body}</p> : null}
            <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">{actions}</div>
          </div>
        </div>
      </Container>
    </section>
  );
}
