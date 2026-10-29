import { Badge, type BadgeProps } from "@/components/ui/badge";
import { entitlementStatus, type EntitlementStatusInput } from "@/lib/entitlement-status";

/** Lifecycle chip shared by customer and admin views (text comes from `entitlementStatus`). */
export function EntitlementStatusChip({
  input,
  size = "sm",
}: {
  input: EntitlementStatusInput;
  size?: BadgeProps["size"];
}) {
  const s = entitlementStatus(input);
  return (
    <Badge tone={s.tone} size={size} className="max-w-full truncate" title={s.label}>
      {s.chip}
    </Badge>
  );
}
