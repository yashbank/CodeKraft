import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/components/ui/_utils";

/** Empty state — docs/07 §4.5: token-coloured icon + title + one sentence + one primary action. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      <Icon aria-hidden className="size-10 text-fg-subtle" />
      <p className="text-h4 text-fg">{title}</p>
      {body ? <p className="max-w-prose text-body-sm text-fg-muted">{body}</p> : null}
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
