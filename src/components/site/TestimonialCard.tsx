import { QuoteIcon } from "lucide-react";

import { cn } from "@/components/ui/_utils";

import type { Testimonial } from "./types";

/** Quote card: pull-quote type, author + role + company. No photos (D-103 applies to founders only; testimonials carry names by consent). */
export function TestimonialCard({
  testimonial,
  className,
}: {
  testimonial: Testimonial;
  className?: string;
}) {
  const t = testimonial;
  return (
    <figure
      className={cn(
        "flex h-full flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-1",
        className,
      )}
    >
      <QuoteIcon aria-hidden className="size-6 text-accent" />
      <blockquote className="flex-1 text-pullquote text-fg">
        <p>&ldquo;{t.quote}&rdquo;</p>
      </blockquote>
      <figcaption className="text-body-sm">
        <span className="font-semibold text-fg">{t.author}</span>
        <span className="text-fg-muted">
          {" "}
          · {t.role}, {t.company}
        </span>
      </figcaption>
    </figure>
  );
}
