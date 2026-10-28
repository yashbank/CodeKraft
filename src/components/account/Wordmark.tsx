import Link from "next/link";

import { cn } from "@/components/ui/_utils";
import { SiteLogo } from "@/components/brand/site-brand";

/** Account/admin-login brand mark: uploaded logo, else the site name as text. */
export function Wordmark({
  href = "/",
  className,
  tag,
}: {
  href?: string;
  className?: string;
  tag?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-display text-fg", className)}
    >
      <SiteLogo />
      {tag ? (
        <span className="rounded-full bg-elevated px-2 py-0.5 text-caption font-semibold text-fg-muted">
          {tag}
        </span>
      ) : null}
    </Link>
  );
}
