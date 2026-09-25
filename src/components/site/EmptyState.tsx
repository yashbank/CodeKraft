import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui/_utils";

/** docs/07 §4.5: token-coloured icon + specific title + one sentence + one primary action. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  actions,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-16 text-center",
        className,
      )}
    >
      <Icon aria-hidden className="size-10 text-fg-subtle" />
      <h3 className="mt-4 text-h4">{title}</h3>
      {body ? <p className="mt-2 max-w-md text-body-sm text-fg-muted">{body}</p> : null}
      {actions ? <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </div>
  );
}
