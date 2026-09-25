import * as React from "react";
import {
  AlarmClockIcon,
  ArrowRightLeftIcon,
  MailIcon,
  PackageCheckIcon,
  PhoneIcon,
  ShieldCheckIcon,
  StickyNoteIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/components/ui/_utils";
import { statusPresentation, type StatusEnum, type StatusValue } from "@/lib/status-tone";

/** Icons named in docs/08 §6.8; unknown names render no icon (label is always present). */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  "package-check": PackageCheckIcon,
  "shield-check": ShieldCheckIcon,
  "alarm-clock": AlarmClockIcon,
  "sticky-note": StickyNoteIcon,
  "arrow-right-left": ArrowRightLeftIcon,
  "user-plus": UserPlusIcon,
  mail: MailIcon,
  phone: PhoneIcon,
};

type StatusBadgeProps<E extends StatusEnum> = Omit<BadgeProps, "tone" | "variant" | "children"> & {
  /** Enum key from `lib/status-tone` (`orders.status`). Alias: `enumName`. */
  kind: E;
  value: StatusValue<E>;
  /** Override the mapped label (e.g. "Shortfall ₹40"). */
  label?: string;
  /** Hide the mapped lucide icon. */
  hideIcon?: boolean;
};

/**
 * `<StatusBadge kind="orders.status" value="paid" />` — the only way a status enum becomes a
 * chip (docs/08 §6.8, §13 "Use status chips from lib/status-tone.ts"). Never colour-only: the
 * label is always rendered; the tone dot and icon are decorative.
 */
function StatusBadge<E extends StatusEnum>({
  kind,
  value,
  label,
  hideIcon = false,
  dot = true,
  className,
  ...props
}: StatusBadgeProps<E>) {
  const presentation = statusPresentation(kind, value);
  const Icon = presentation.icon && !hideIcon ? ICONS[presentation.icon] : undefined;

  return (
    <Badge
      tone={presentation.tone}
      dot={dot && !Icon}
      data-status-enum={kind}
      data-status-value={value}
      className={cn(className)}
      {...props}
    >
      {Icon ? <Icon aria-hidden /> : null}
      {label ?? presentation.label}
    </Badge>
  );
}

export { StatusBadge, type StatusBadgeProps };
