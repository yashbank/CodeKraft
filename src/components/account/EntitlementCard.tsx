import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { entitlementStatus, type EntitlementStatusInput } from "@/lib/entitlement-status";
import { cn } from "@/components/ui/_utils";
import { DELIVERY_LABELS, DeliveryTypeIcon, primaryActionLabel } from "./DeliveryTypeIcon";
import { EntitlementStatusChip } from "./EntitlementStatusChip";
import { ProductCover } from "./ProductCover";
import type { EntitlementSummary } from "./types";

/** Input for the shared lifecycle label, from a customer entitlement row. */
export function entitlementStatusInput(e: EntitlementSummary): EntitlementStatusInput {
  return {
    status: e.status,
    provisioningState: e.provisioningState,
    startsAt: e.accessStartsAt,
    endsAt: e.accessEndsAt,
    subscriptionPeriodEnd: e.subscription?.currentPeriodEnd,
    refunded: e.refunded,
  };
}

/** Status copy for entitlements (SCR-ACC-01 §Content). */
export function entitlementStatusLine(e: EntitlementSummary): string {
  return entitlementStatus(entitlementStatusInput(e)).label;
}

/**
 * Entitlement card / row (SCR-ACC-01 `EntitlementCard`, SCR-ACC-02 `EntitlementRow`): cover,
 * product + offering, delivery type, status chip, access line, type-specific line and the primary
 * action per delivery type. `compact` renders the phone row.
 */
export function EntitlementCard({
  entitlement: e,
  detailHref,
  compact = false,
  className,
}: {
  entitlement: EntitlementSummary;
  detailHref: string;
  compact?: boolean;
  className?: string;
}) {
  const action = primaryActionLabel(e.deliveryType, !!e.subscription);
  const disabled = e.status !== "active" && e.status !== "suspended";
  const progress =
    e.stepsTotal && e.stepsDone !== undefined
      ? Math.round((e.stepsDone / e.stepsTotal) * 100)
      : null;
  return (
    <article
      className={cn(
        "flex gap-4 rounded-lg border border-border bg-surface p-4 shadow-1",
        compact ? "items-center" : "flex-col sm:flex-row sm:items-start",
        className,
      )}
      aria-labelledby={`ent-${e.id}-title`}
    >
      <ProductCover
        name={e.productName}
        imageUrl={e.productImageUrl}
        className={compact ? "size-12" : "size-16"}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`ent-${e.id}-title`} className="text-body font-semibold text-fg">
            <Link href={detailHref} className="hover:underline">
              {e.productName}
            </Link>
          </h3>
          <EntitlementStatusChip input={entitlementStatusInput(e)} />
        </div>
        <p className="truncate text-body-sm text-fg-muted">{e.offeringName}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <DeliveryTypeIcon type={e.deliveryType} className="size-3.5" />
            {DELIVERY_LABELS[e.deliveryType]}
          </span>
          <span>{entitlementStatusLine(e)}</span>
          {e.secondaryLine ? <span className="text-fg">{e.secondaryLine}</span> : null}
        </p>
        {progress !== null && !compact ? (
          <Progress
            value={progress}
            aria-label={`${e.stepsDone} of ${e.stepsTotal} steps complete`}
            className="max-w-xs"
          />
        ) : null}
      </div>
      <div className={cn("flex shrink-0 gap-2", compact ? "" : "sm:flex-col sm:items-end")}>
        <Button
          size="sm"
          variant={e.status === "suspended" ? "secondary" : "primary"}
          disabled={disabled}
          asChild={!disabled}
        >
          {disabled ? (
            <span>{action}</span>
          ) : (
            <Link href={detailHref}>{e.status === "suspended" ? "Renew" : action}</Link>
          )}
        </Button>
        {!compact ? (
          <Link href={detailHref} className="text-body-sm text-accent-text hover:underline">
            Details
          </Link>
        ) : null}
      </div>
    </article>
  );
}
