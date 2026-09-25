import { ExternalLinkIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatDateTime } from "../format";
import type { EntitlementDetail } from "../types";

/**
 * SaaS / hosted panel (SCR-ACC-03): "Being set up" while provisioning is pending (expected
 * timeframe copy), otherwise "Ready" with the login URL button and username. Credentials are
 * never stored on this page.
 */
export function HostedPanel({
  productName,
  provisioningState,
  hosted,
}: {
  productName: string;
  provisioningState: EntitlementDetail["provisioningState"];
  hosted?: EntitlementDetail["hosted"];
}) {
  if (provisioningState === "pending" || !hosted) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-h3 text-fg">Being set up</h2>
          <StatusBadge kind="entitlements.provisioning_state" value="pending" />
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-body-sm text-fg-muted">
          <Loader2Icon aria-hidden className="mt-0.5 size-5 shrink-0 animate-spin text-info" />
          <p>
            We provision {productName} by hand within one working day
            {hosted?.expectedBy ? ` — expected by ${formatDateTime(hosted.expectedBy)}` : ""}.
            You&apos;ll get an email and a notification here when it&apos;s ready.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-h3 text-fg">Ready</h2>
        <StatusBadge kind="entitlements.provisioning_state" value="done" />
      </div>
      <div className="grid gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <dl className="grid gap-2 text-body-sm">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-fg-muted">Username</dt>
            <dd className="font-mono text-fg">{hosted.username}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-fg-muted">Credentials</dt>
            <dd className="text-fg">
              Sent to your email on {formatDate(hosted.credentialsSentAt)}
            </dd>
          </div>
        </dl>
        <Button asChild>
          <a href={hosted.loginUrl} target="_blank" rel="noreferrer">
            Open {productName} <ExternalLinkIcon aria-hidden />
          </a>
        </Button>
      </div>
    </div>
  );
}
