import type { ReactNode } from "react";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/components/ui/_utils";

export type BannerTone = "info" | "success" | "warning" | "danger" | "neutral";

const TONE: Record<BannerTone, { box: string; rule: string; Icon: LucideIcon }> = {
  info: { box: "bg-info-soft text-info", rule: "border-info", Icon: InfoIcon },
  success: { box: "bg-success-soft text-success", rule: "border-success", Icon: CircleCheckIcon },
  warning: {
    box: "bg-warning-soft text-warning",
    rule: "border-warning",
    Icon: TriangleAlertIcon,
  },
  danger: { box: "bg-danger-soft text-danger", rule: "border-danger", Icon: CircleAlertIcon },
  neutral: { box: "bg-elevated text-fg-muted", rule: "border-border-strong", Icon: InfoIcon },
};

/**
 * Banner / Alert — docs/08 §6.18: tone `-soft` fill, tone text, 4px left rule. `danger` announces
 * with `role="alert"`; the others are polite `status` regions (docs/07 §4.6).
 */
export function Banner({
  tone = "info",
  title,
  children,
  action,
  role,
  className,
}: {
  tone?: BannerTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  role?: "alert" | "status" | "none";
  className?: string;
}) {
  const t = TONE[tone];
  const resolvedRole = role ?? (tone === "danger" ? "alert" : "status");
  return (
    <div
      role={resolvedRole === "none" ? undefined : resolvedRole}
      className={cn(
        "flex flex-col gap-3 rounded-md border-l-4 p-4 text-body-sm sm:flex-row sm:items-start",
        t.box,
        t.rule,
        className,
      )}
    >
      <t.Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-fg">{children}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
