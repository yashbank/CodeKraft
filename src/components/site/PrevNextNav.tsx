import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/components/ui/_utils";

export interface PrevNextItem {
  href: string;
  title: string;
  eyebrow?: string;
}

/** Previous / next pair for case studies and blog posts. */
export function PrevNextNav({
  prev,
  next,
  label = "Adjacent pages",
  className,
}: {
  prev?: PrevNextItem;
  next?: PrevNextItem;
  label?: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {prev ? (
        <Link
          href={prev.href}
          className="group flex flex-col gap-1 rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="inline-flex items-center gap-1.5 text-caption text-fg-muted">
            <ArrowLeftIcon aria-hidden className="size-3.5" /> {prev.eyebrow ?? "Previous"}
          </span>
          <span className="text-body font-medium text-fg group-hover:text-accent-text">
            {prev.title}
          </span>
        </Link>
      ) : (
        <span aria-hidden />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group flex flex-col items-end gap-1 rounded-lg border border-border bg-surface p-5 text-right transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="inline-flex items-center gap-1.5 text-caption text-fg-muted">
            {next.eyebrow ?? "Next"} <ArrowRightIcon aria-hidden className="size-3.5" />
          </span>
          <span className="text-body font-medium text-fg group-hover:text-accent-text">
            {next.title}
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
