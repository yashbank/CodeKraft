import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/components/ui/_utils";

import { ServiceIcon } from "./ServiceIcon";
import type { Service } from "./types";

/**
 * Service card (landing "What we build"); the whole card is one link to `/services#slug`.
 * Design system §6.3: surface + hairline, hover lift + glow (pointer devices only), reduced-motion safe.
 */
export function ServiceCard({
  service,
  className,
}: Readonly<{ service: Service; className?: string }>) {
  const highlights = service.deliverables.slice(0, 3);
  const titleId = `service-card-${service.slug}`;
  return (
    <Link
      href={`/services#${service.slug}`}
      aria-labelledby={titleId}
      data-slot="service-card"
      className={cn(
        "group flex h-full flex-col gap-4 rounded-lg border border-border bg-surface p-5 text-fg shadow-1 transition-[box-shadow,transform,border-color] duration-(--ck-motion-duration-md) ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none md:p-6 pointer-fine:hover:-translate-y-0.5 pointer-fine:hover:border-accent/50 pointer-fine:hover:shadow-glow motion-reduce:pointer-fine:hover:translate-y-0",
        className,
      )}
    >
      <ServiceIcon name={service.icon} />
      <div className="min-w-0 flex-1 space-y-2">
        <h3 id={titleId} className="text-h4">
          {service.title}
        </h3>
        <p className="line-clamp-3 text-body-sm text-fg-muted">{service.summary}</p>
        {highlights.length > 0 && (
          <ul className="space-y-1 pt-1 text-caption text-fg-muted">
            {highlights.map((h) => (
              <li key={h} className="flex gap-2">
                <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                <span className="line-clamp-1">{h}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ArrowRightIcon
        aria-hidden
        className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent-text motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      />
    </Link>
  );
}
