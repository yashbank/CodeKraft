import type { ReactNode } from "react";

import { cn } from "@/components/ui/_utils";

/** Page header: h1 (one per page), optional description/meta row and right-aligned actions. */
export function PageHeader({
  title,
  description,
  meta,
  actions,
  className,
  titleAdornment,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  titleAdornment?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-h2">{title}</h1>
          {titleAdornment}
        </div>
        {description ? (
          <p className="max-w-prose text-body-sm text-fg-muted">{description}</p>
        ) : null}
        {meta ? (
          <div className="flex flex-wrap items-center gap-2 text-body-sm text-fg-muted">{meta}</div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Section heading inside a page (h2). */
export function SectionHeading({
  title,
  actions,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-h4">{title}</h2>
      {actions}
    </div>
  );
}
