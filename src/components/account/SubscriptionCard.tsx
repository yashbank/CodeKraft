"use client";

import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "@/lib/money";
import { ConfirmDialog } from "./ConfirmDialog";
import { formatDate } from "./format";
import type { SubscriptionInfo } from "./types";

const INTERVAL = { monthly: "Monthly", quarterly: "Quarterly", annual: "Annual" } as const;

/**
 * Subscription card (SCR-ACC-03): interval, current period end, next amount, "Renew now" (14 days
 * before period end through grace, D-521), "Cancel at period end" (plain confirm). Cancelled shows
 * "Access until <date>"; no Resume (V2).
 */
export function SubscriptionCard({
  subscription: s,
  renewHref,
  onCancel,
}: {
  subscription: SubscriptionInfo;
  renewHref: string;
  onCancel?: () => void;
}) {
  const ending = s.cancelAtPeriodEnd || s.status === "cancelled";
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center justify-between gap-2">
          Subscription
          <StatusBadge kind="subscriptions.status" value={s.status} size="sm" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        <dl className="grid gap-2 text-body-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-fg-muted">Billing</dt>
            <dd className="text-fg">{INTERVAL[s.interval]}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-fg-muted">{ending ? "Access until" : "Current period ends"}</dt>
            <dd className="text-fg">{formatDate(s.currentPeriodEnd)}</dd>
          </div>
          {!ending ? (
            <div className="flex justify-between gap-2">
              <dt className="text-fg-muted">Next due</dt>
              <dd className="font-mono tnum text-fg">{format(s.nextDue)}</dd>
            </div>
          ) : null}
        </dl>
        {s.status === "past_due" ? (
          <p className="text-body-sm text-warning">
            Payment overdue — renew now to keep access during the grace period.
          </p>
        ) : null}
        {ending ? (
          <p className="text-body-sm text-fg-muted">
            This subscription will end on {formatDate(s.currentPeriodEnd)}. You keep access until
            then.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Button disabled={!s.renewable} asChild={s.renewable}>
              {s.renewable ? <Link href={renewHref}>Renew now</Link> : <span>Renew now</span>}
            </Button>
            {!s.renewable ? (
              <p className="text-caption text-fg-subtle">
                Renewal opens 14 days before the period ends.
              </p>
            ) : null}
            <ConfirmDialog
              trigger={<Button variant="secondary">Cancel at period end</Button>}
              title="Cancel this subscription at period end?"
              description={`You keep access until ${formatDate(s.currentPeriodEnd)}. There's no proration and it can't be resumed afterwards — you'd subscribe again.`}
              confirmLabel="Cancel at period end"
              onConfirm={() => {
                onCancel?.();
                toast.success(`Subscription will end on ${formatDate(s.currentPeriodEnd)}`);
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
