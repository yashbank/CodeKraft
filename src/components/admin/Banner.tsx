import {
  CircleAlertIcon,
  InfoIcon,
  LockIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui/_utils";

const TONES = {
  info: { fill: "bg-info-soft text-info border-info", Icon: InfoIcon },
  success: { fill: "bg-success-soft text-success border-success", Icon: ShieldCheckIcon },
  warning: { fill: "bg-warning-soft text-warning border-warning", Icon: TriangleAlertIcon },
  danger: { fill: "bg-danger-soft text-danger border-danger", Icon: CircleAlertIcon },
  neutral: { fill: "bg-elevated text-fg-muted border-border-strong", Icon: LockIcon },
} as const;

/** Banner / Alert — docs/08 §6.18: tone-soft fill, tone text, 4px left rule, icon 20px. */
export function Banner({
  tone = "info",
  title,
  children,
  icon,
  action,
  role,
  className,
}: {
  tone?: keyof typeof TONES;
  title?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  role?: "status" | "alert";
  className?: string;
}) {
  const { fill, Icon } = TONES[tone];
  const Glyph = icon ?? Icon;
  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-3 rounded-md border-l-4 px-4 py-3 text-body-sm",
        fill,
        className,
      )}
    >
      <Glyph aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-fg">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

/** Approval-gate note used by every dual-approval form (docs/07 §4.11, BR-13). */
export function ApprovalGateNotice({ approvers, what }: { approvers: string[]; what: string }) {
  return (
    <Banner tone="info" icon={ShieldCheckIcon} title="Requires approval">
      {what} creates an approval request.{" "}
      {approvers.length > 0
        ? `${approvers.join(" and ")} must approve`
        : "Another admin must approve"}{" "}
      before it takes effect; you cannot approve your own request.
    </Banner>
  );
}
