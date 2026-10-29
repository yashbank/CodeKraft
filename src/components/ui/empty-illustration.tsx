import type { LucideIcon } from "lucide-react";

import { cn } from "./_utils";

/**
 * Empty-state artwork (P14-12b): a tray with floating cards and sparkles drawn in theme tokens
 * (accent / border / fg-subtle), the state's icon sitting on top. Decorative, so aria-hidden.
 */
export function EmptyIllustration({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("relative h-24 w-32 shrink-0", className)}>
      <svg viewBox="0 0 128 96" fill="none" className="absolute inset-0 size-full">
        <ellipse cx="64" cy="86" rx="40" ry="5" className="fill-border" opacity=".6" />
        <rect
          x="22"
          y="38"
          width="84"
          height="42"
          rx="8"
          className="fill-accent-soft stroke-border-strong"
          strokeWidth="1.5"
        />
        <path
          d="M22 58h26l4 8h24l4-8h26"
          className="stroke-border-strong"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <rect
          x="36"
          y="22"
          width="22"
          height="20"
          rx="3"
          transform="rotate(-8 47 32)"
          className="fill-surface stroke-border"
          strokeWidth="1.5"
        />
        <rect
          x="72"
          y="20"
          width="22"
          height="22"
          rx="3"
          transform="rotate(7 83 31)"
          className="fill-surface stroke-border"
          strokeWidth="1.5"
        />
        <path
          d="M18 24v8M14 28h8"
          className="stroke-accent"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M110 12v6M107 15h6"
          className="stroke-accent"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="104" cy="34" r="2" className="fill-fg-subtle" />
      </svg>
      <Icon className="absolute left-1/2 top-[52%] size-7 -translate-x-1/2 -translate-y-1/2 text-fg-subtle" />
    </div>
  );
}
