import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui/_utils";

/** Empty state — docs/08 §6.18: 40px icon, h4 title, muted body, optional action. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center",
        className,
      )}
    >
      {Icon ? <Icon aria-hidden className="size-10 text-fg-subtle" /> : null}
      <p className="text-h4">{title}</p>
      {body ? <p className="max-w-prose text-body-sm text-fg-muted">{body}</p> : null}
      {action}
    </div>
  );
}
