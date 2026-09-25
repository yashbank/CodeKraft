import Link from "next/link";

import { cn } from "@/components/ui/_utils";

/** Text wordmark (docs/08 §3.1 "Kraft Bracket" direction) until the logo asset lands. */
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
      className={cn(
        "inline-flex items-center gap-2 font-display text-h4 font-semibold tracking-tight text-fg",
        className,
      )}
    >
      <span aria-hidden className="font-mono text-accent-text">
        {"{"}
      </span>
      <span>CodeKraft</span>
      <span aria-hidden className="font-mono text-accent-text">
        {"}"}
      </span>
      {tag ? (
        <span className="rounded-full bg-elevated px-2 py-0.5 text-caption font-semibold text-fg-muted">
          {tag}
        </span>
      ) : null}
    </Link>
  );
}
