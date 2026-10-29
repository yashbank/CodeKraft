import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/components/ui/_utils";
import { AnimatedNumber } from "./use-count-up";

/** Stat card — docs/08 §6.3: overline label, 28px 600 tabular value, delta chip. */
export function StatTile({
  label,
  value,
  delta,
  deltaTone,
  hint,
  count,
  href,
  children,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaTone?: "success" | "danger" | "neutral";
  hint?: string;
  /** Numeric value to count up on first view (`format` renders it); replaces `value`. */
  count?: { to: number; format: (n: number) => string };
  /** Drill-down: the label links to the filtered list. */
  href?: string;
  children?: ReactNode;
  className?: string;
}) {
  const tone =
    deltaTone ??
    (delta?.trim().startsWith("+")
      ? "success"
      : delta?.trim().startsWith("-") || delta?.trim().startsWith("−")
        ? "danger"
        : "neutral");
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-4", className)}>
      <div className="text-overline tracking-wider text-fg-muted uppercase">
        {href ? (
          <Link href={href} className="hover:text-accent-text hover:underline">
            {label}
          </Link>
        ) : (
          label
        )}
      </div>
      <div className="mt-1 text-[clamp(20px,1.6vw,28px)] leading-tight font-semibold break-words text-fg tnum">
        {count ? <AnimatedNumber value={count.to} format={count.format} /> : value}
      </div>
      {delta ? (
        <div
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-caption font-medium",
            tone === "success" && "text-success",
            tone === "danger" && "text-danger",
            tone === "neutral" && "text-fg-muted",
          )}
        >
          {tone === "success" ? <ArrowUpRightIcon aria-hidden className="size-3.5" /> : null}
          {tone === "danger" ? <ArrowDownRightIcon aria-hidden className="size-3.5" /> : null}
          {delta}
        </div>
      ) : null}
      {hint ? <div className="mt-1 text-caption text-fg-subtle">{hint}</div> : null}
      {children}
    </div>
  );
}
