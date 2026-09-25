import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/_utils";

import { MediaPlaceholder } from "./MediaPlaceholder";
import type { CaseStudySummary } from "./types";

/** Case-study card — docs/08 §6.3: 4:3 cover + industry chip, client overline, h3, result stat, tech chips. */
export function CaseStudyCard({
  study,
  className,
}: {
  study: CaseStudySummary;
  className?: string;
}) {
  const href = `/projects/${study.slug}`;
  return (
    <Card
      data-interactive="true"
      className={cn("group relative gap-0 overflow-hidden py-0", className)}
    >
      <div className="relative p-3 pb-0">
        <MediaPlaceholder alt={study.coverAlt} tone={study.coverTone} ratio="4/3" />
        <Badge tone="neutral" className="absolute top-5 left-5">
          {study.industry}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-overline tracking-wider text-fg-muted uppercase">
          {study.client ?? "Confidential client"}
        </p>
        <h3 className="text-h3">
          <Link
            href={href}
            className="rounded-xs after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {study.title}
          </Link>
        </h3>
        <p className="text-price text-accent-text tnum">{study.resultHighlight}</p>
        <ul aria-label="Tech stack" className="flex flex-wrap gap-1.5">
          {study.techStack.slice(0, 3).map((t) => (
            <li key={t}>
              <Badge tone="ghost" size="sm">
                {t}
              </Badge>
            </li>
          ))}
        </ul>
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-body-sm font-medium text-accent-text">
          Read case study{" "}
          <ArrowRightIcon
            aria-hidden
            className="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </Card>
  );
}

export function CaseStudyCardSkeleton({ className }: { className?: string }) {
  return (
    <Card aria-hidden className={cn("gap-0 overflow-hidden py-0", className)}>
      <div className="p-3 pb-0">
        <Skeleton className="aspect-[4/3] w-full" />
      </div>
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
      </div>
    </Card>
  );
}
