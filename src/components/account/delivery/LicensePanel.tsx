"use client";

import { KeyRoundIcon, ShieldIcon } from "lucide-react";
import * as React from "react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { revealLicenseKey } from "@/modules/entitlements/customer-mutations";
import { CopyButton } from "../CopyButton";
import { EmptyState } from "../EmptyState";

/**
 * License panel (SCR-ACC-03): masked key → "Reveal key" (audit-logged; may re-prompt for the
 * password) shows the full key for 60 s with Copy. "Key not issued yet" state when absent.
 * With `entitlementId` the real key is fetched via `revealLicenseKey` (API-DEL-03, R8-03);
 * `licenseKey.full` from the read model is only the masked value and is never shown as "the key".
 */
export function LicensePanel({
  licenseKey,
  entitlementId,
  revealSeconds = 60,
  onReveal,
}: {
  licenseKey?: { masked: string; full: string };
  entitlementId?: string;
  revealSeconds?: number;
  onReveal?: () => Promise<void> | void;
}) {
  const [remaining, setRemaining] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [fullKey, setFullKey] = React.useState<string | null>(null);
  const revealed = remaining > 0;
  const shownKey = fullKey ?? licenseKey?.full ?? "";

  React.useEffect(() => {
    if (remaining <= 0) return;
    const t = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(t);
  }, [remaining]);

  if (!licenseKey) {
    return (
      <EmptyState
        icon={KeyRoundIcon}
        title="Being prepared — you'll get an email when it's ready"
        body="Keys are only ever shown here in your dashboard, never in email."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-h3 text-fg">License key</h2>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-canvas p-4 sm:flex-row sm:items-center">
        <code className="flex-1 font-mono text-body-lg tracking-wider text-fg" aria-live="polite">
          {revealed ? shownKey : licenseKey.masked}
        </code>
        <div className="flex items-center gap-2">
          {revealed ? (
            <>
              <CopyButton value={shownKey} label="License key" variant="secondary" size="sm" />
              <span className="text-caption text-fg-muted">Hides in {remaining} s</span>
            </>
          ) : (
            <Button
              size="sm"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (entitlementId) {
                    const res = await revealLicenseKey({ entitlementId });
                    if (!res.ok) {
                      toast.error(res.error.message);
                      return;
                    }
                    setFullKey(res.data.licenseKey);
                  }
                  await onReveal?.();
                  setRemaining(revealSeconds);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Reveal key
            </Button>
          )}
        </div>
      </div>
      <p className="flex items-start gap-2 text-caption text-fg-muted">
        <ShieldIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Revealing is recorded in your account activity. If you signed in more than 60 minutes ago we
        may ask for your password first.
      </p>
    </div>
  );
}
