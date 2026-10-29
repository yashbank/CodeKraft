"use client";

import * as React from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/account/CopyButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCustomerTempPassword,
  generateAccessLink,
  inviteCustomerLink,
  issueTempPassword,
} from "@/modules/auth/invite-actions";

/** Target = existing user (reset / invite link, temp password). No target = new customer by email. */
export interface AccessTarget {
  userId: string;
  label: string;
}

type Secret = { kind: "link"; value: string; note: string } | { kind: "password"; value: string };

/**
 * P10: generate a single-use link (Copy link) or a one-time temporary password for a user.
 * Generating again replaces the previous link/password. The secret lives only in this component's
 * state and is dropped when the dialog closes.
 */
export function AccessDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target?: AccessTarget | null;
}) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [secret, setSecret] = React.useState<Secret | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSecret(null);
      setEmail("");
      setName("");
    }
  }, [open]);

  async function run(kind: "link" | "password") {
    if (!target && (!email.trim() || (kind === "password" && !name.trim()))) {
      toast.error(kind === "password" ? "Email and name are required." : "Email is required.");
      return;
    }
    setBusy(true);
    setSecret(null);
    try {
      if (kind === "link") {
        const res = target
          ? await generateAccessLink({ userId: target.userId })
          : await inviteCustomerLink({ email: email.trim() });
        if (!res.ok) return void toast.error(res.error.message);
        const days = res.data.expiresAt;
        setSecret({
          kind: "link",
          value: res.data.url,
          note: `Single use. Any earlier link no longer works. Expires ${new Date(days).toLocaleString()}.`,
        });
      } else {
        const res = target
          ? await issueTempPassword({ userId: target.userId })
          : await createCustomerTempPassword({ email: email.trim(), name: name.trim() });
        if (!res.ok) return void toast.error(res.error.message);
        setSecret({ kind: "password", value: res.data.password });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{target ? `Access for ${target.label}` : "Invite customer"}</DialogTitle>
          <DialogDescription>
            Email is not delivered yet, so share the link or password yourself. They are shown once.
          </DialogDescription>
        </DialogHeader>
        {!target ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="acc-email" required>
                Email
              </Label>
              <Input
                id="acc-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-name">Name (needed for a temporary password)</Label>
              <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void run("link")}>
            {secret?.kind === "link" ? "Regenerate link" : "Generate link"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void run("password")}
          >
            {secret?.kind === "password" ? "Regenerate temporary password" : "Temporary password"}
          </Button>
        </div>
        <div aria-live="polite">
          {secret ? (
            <div className="space-y-2 rounded-md border border-border bg-surface-2 p-3">
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all text-body-sm" data-testid="access-secret">
                  {secret.value}
                </code>
                <CopyButton
                  value={secret.value}
                  label={secret.kind === "link" ? "link" : "temporary password"}
                />
              </div>
              <p className="text-caption text-fg-muted">
                {secret.kind === "link"
                  ? secret.note
                  : "Shown once and not stored. The user must choose a new password at first sign-in; their old password and sessions were revoked."}
              </p>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
