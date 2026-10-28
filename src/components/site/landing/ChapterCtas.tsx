import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import type { LandingChapterCopy } from "../types";

type CtaLink = { label: string; href: string };

/**
 * Buttons under a chapter, from the admin-stored CTA. Unset content (null/undefined) shows the
 * `fallback` links; once set, an empty secondary label/href hides that button.
 */
export function ChapterCtas({
  cta,
  fallback = [],
  className = "mt-6",
}: {
  cta: LandingChapterCopy["cta"];
  fallback?: CtaLink[];
  className?: string;
}) {
  if (!cta) {
    return fallback.length ? (
      <div className={className}>
        {fallback.map((l) => (
          <Button key={l.href} asChild variant="link">
            <Link href={l.href}>
              {l.label} <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        ))}
      </div>
    ) : null;
  }
  const secondary = cta.secondary?.label && cta.secondary.href ? cta.secondary : null;
  return (
    <div className={`${className} flex flex-wrap gap-3`}>
      <Button asChild>
        <Link href={cta.primary.href}>{cta.primary.label}</Link>
      </Button>
      {secondary ? (
        <Button asChild variant="secondary">
          <Link href={secondary.href}>{secondary.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
