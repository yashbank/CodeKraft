import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/_utils";

import { ServiceIcon } from "./ServiceIcon";
import type { Service } from "./types";

/** Compact service card for the landing "What we build" chapter; links to `/services#slug`. */
export function ServiceCard({ service, className }: { service: Service; className?: string }) {
  return (
    <Card data-interactive="true" className={cn("group relative gap-3 py-5", className)}>
      <div className="flex items-start gap-4 px-5">
        <ServiceIcon name={service.icon} className="size-10 [&>svg]:size-5" />
        <div className="min-w-0 space-y-1">
          <h3 className="text-h4">
            <Link
              href={`/services#${service.slug}`}
              className="rounded-xs after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {service.title}
            </Link>
          </h3>
          <p className="line-clamp-2 text-body-sm text-fg-muted">{service.summary}</p>
        </div>
        <ArrowRightIcon
          aria-hidden
          className="ml-auto size-4 shrink-0 self-center text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent-text"
        />
      </div>
    </Card>
  );
}
