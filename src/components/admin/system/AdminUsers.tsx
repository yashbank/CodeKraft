"use client";

import Link from "next/link";
import * as React from "react";
import { KeyRoundIcon, PlusIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupCard } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApprovalGateNotice, Banner } from "../Banner";
import { formatDateTime, initials } from "../format";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { AdminRole, AdminUserRow } from "../types";

const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
};
const ROLE_SUMMARY: Record<AdminRole, string> = {
  super_admin:
    "Everything: settings, all products, all partners, all leads, legal pages, admin users.",
  admin: "Own products, own share, assigned leads and queries; cannot change settings.",
  staff: "Read-only operations (defined, not seeded in release 1).",
};

export interface AdminUsersProps {
  users: AdminUserRow[];
  currentUserId: string;
  approvers: string[];
  approvalsHref: string;
  productHref: string;
  auditHref: string;
}

/**
 * SCR-ADM-31 — admin users & roles: <2 active admins warning, table with role/partner/TOTP/status,
 * invite dialog with permission summaries (dual-approved), last-Super-Admin rule on role change /
 * removal, partner details sheet and the self-service Security (TOTP) dialog.
 */
export function AdminUsers({
  users,
  currentUserId,
  approvers,
  approvalsHref,
  productHref,
  auditHref,
}: AdminUsersProps) {
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [invitePartner, setInvitePartner] = React.useState(false);
  const [securityOpen, setSecurityOpen] = React.useState(false);
  const [partnerSheet, setPartnerSheet] = React.useState<AdminUserRow | null>(null);
  const [confirm, setConfirm] = React.useState<{
    kind: "role" | "remove";
    user: AdminUserRow;
  } | null>(null);
  const [reveal, setReveal] = React.useState(false);
  const activeAdmins = users.filter(
    (u) => u.status === "active" && (u.role === "admin" || u.role === "super_admin"),
  );
  const superAdmins = users.filter((u) => u.status === "active" && u.role === "super_admin");

  return (
    <>
      <PageHeader
        title="Admin users"
        description="Invite admins, change roles, remove access and maintain partner records. Every change is dual-approved (BR-13)."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setSecurityOpen(true)}>
              <KeyRoundIcon aria-hidden /> Security (my TOTP)
            </Button>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <PlusIcon aria-hidden /> Invite admin
            </Button>
          </>
        }
      />
      {activeAdmins.length < 2 ? (
        <Banner tone="warning" className="mb-4">
          Only one active admin — dual-approval actions (publish, splits, refunds, payouts,
          adjustments) cannot be executed until a second admin is active.
        </Banner>
      ) : null}
      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableCaption className="sr-only">Admin users</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>TOTP</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const lastSuper = u.role === "super_admin" && superAdmins.length === 1;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <span className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <span>
                        <span className="block font-medium">
                          {u.name}
                          {u.id === currentUserId ? (
                            <span className="text-fg-muted"> (you)</span>
                          ) : null}
                        </span>
                        <span className="block text-caption text-fg-muted">{u.email}</span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      tone={
                        u.role === "super_admin"
                          ? "accent"
                          : u.role === "admin"
                            ? "info"
                            : "neutral"
                      }
                    >
                      {ROLE_LABEL[u.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.partner ? (
                      <button
                        type="button"
                        className="text-left hover:text-accent-text"
                        onClick={() => setPartnerSheet(u)}
                      >
                        {u.partner.displayName}
                        <span className="block text-caption text-fg-muted">
                          {u.partner.activeShares} active shares
                        </span>
                      </button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {u.totp ? (
                      <Badge tone="success" size="sm">
                        <ShieldCheckIcon aria-hidden /> Enabled
                      </Badge>
                    ) : (
                      <Badge tone="warning" size="sm">
                        Not set up
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-fg-muted">
                    {u.lastSignInAt ? formatDateTime(u.lastSignInAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      <Badge
                        tone={
                          u.status === "active"
                            ? "success"
                            : u.status === "invited"
                              ? "info"
                              : "warning"
                        }
                        size="sm"
                      >
                        {u.status === "pending_change"
                          ? "Pending change"
                          : u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                      </Badge>
                      {u.pendingApprovalId ? (
                        <Link href={approvalsHref}>
                          <Badge tone="warning" size="sm">
                            approval
                          </Badge>
                        </Link>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <RowActions
                      label={`Actions for ${u.name}`}
                      actions={[
                        {
                          label: "Change role",
                          onSelect: () => setConfirm({ kind: "role", user: u }),
                        },
                        {
                          label: "Edit partner details",
                          onSelect: () => setPartnerSheet(u),
                          disabled: !u.partner,
                        },
                        { label: "Resend invite", disabled: u.status !== "invited" },
                        {
                          label: "Revoke sessions",
                          onSelect: () => toast.success(`Sessions revoked for ${u.name} (audited)`),
                          separatorBefore: true,
                        },
                        {
                          label: "Remove access",
                          destructive: true,
                          onSelect: () => setConfirm({ kind: "remove", user: u }),
                          disabled: lastSuper,
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-caption text-fg-muted">
        Removing the last Super Admin is not allowed. A partner holding active shares must have
        ownership reassigned first (
        <Link href={productHref} className="text-accent-text hover:underline">
          product editor › Ownership
        </Link>
        ).{" "}
        <Link href={auditHref} className="text-accent-text hover:underline">
          Audit trail
        </Link>
        .
      </p>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Invite admin</DialogTitle>
            <DialogDescription>
              The other admin(s) must approve before the invite is sent (BR-13). The email mentions
              the admin host and recommends TOTP.
            </DialogDescription>
          </DialogHeader>
          <Field id="inv-email" label="Email" required>
            <Input id="inv-email" type="email" required aria-required />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-body-sm font-semibold">Role *</legend>
            <RadioGroup defaultValue="admin" className="grid gap-2">
              {(["super_admin", "admin", "staff"] as AdminRole[]).map((r) => (
                <RadioGroupCard key={r} value={r} disabled={r === "staff"}>
                  <span className="text-body font-semibold">{ROLE_LABEL[r]}</span>
                  <span className="text-caption text-fg-muted">{ROLE_SUMMARY[r]}</span>
                </RadioGroupCard>
              ))}
            </RadioGroup>
          </fieldset>
          <div className="flex items-center gap-2">
            <Switch id="inv-partner" checked={invitePartner} onCheckedChange={setInvitePartner} />
            <Label htmlFor="inv-partner">Also a partner</Label>
          </div>
          {invitePartner ? (
            <Field id="inv-partner-name" label="Partner display name" required>
              <Input id="inv-partner-name" required aria-required />
            </Field>
          ) : null}
          <ApprovalGateNotice approvers={approvers} what="Inviting an admin" />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                toast.success("Invite approval requested");
                setInviteOpen(false);
              }}
            >
              Request approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === "remove"
                ? `Remove access for ${confirm.user.name}?`
                : `Change role of ${confirm?.user.name}?`}
            </DialogTitle>
            <DialogDescription>
              {confirm?.user.role === "super_admin" && superAdmins.length === 1
                ? "Removing the last Super Admin is not allowed."
                : confirm?.user.partner &&
                    confirm.user.partner.activeShares > 0 &&
                    confirm.kind === "remove"
                  ? "This partner holds active shares — reassign ownership first."
                  : activeAdmins.length <= 2 && confirm?.kind === "remove"
                    ? "This leaves fewer than two admin-class users; dual-approval actions will be blocked until another admin is active."
                    : "Another admin must approve this change."}
            </DialogDescription>
          </DialogHeader>
          {confirm?.kind === "role" ? (
            <Field id="role-new" label="New role">
              <RadioGroup
                defaultValue={confirm.user.role === "admin" ? "super_admin" : "admin"}
                className="grid gap-2"
              >
                {(["super_admin", "admin"] as AdminRole[]).map((r) => (
                  <RadioGroupCard key={r} value={r}>
                    <span className="text-body font-semibold">{ROLE_LABEL[r]}</span>
                    <span className="text-caption text-fg-muted">{ROLE_SUMMARY[r]}</span>
                  </RadioGroupCard>
                ))}
              </RadioGroup>
            </Field>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant={confirm?.kind === "remove" ? "destructive" : "primary"}
              disabled={Boolean(
                confirm &&
                ((confirm.user.role === "super_admin" && superAdmins.length === 1) ||
                  (confirm.kind === "remove" &&
                    confirm.user.partner &&
                    confirm.user.partner.activeShares > 0)),
              )}
              onClick={() => {
                toast.success("Approval requested");
                setConfirm(null);
              }}
            >
              Request approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={partnerSheet !== null} onOpenChange={(o) => !o && setPartnerSheet(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Partner details</SheetTitle>
            <SheetDescription>
              Bank details are encrypted at rest; revealing them is audited.
            </SheetDescription>
          </SheetHeader>
          <form className="space-y-4 px-4" onSubmit={(e) => e.preventDefault()}>
            <Field id="pt-name" label="Display name" required>
              <Input id="pt-name" defaultValue={partnerSheet?.partner?.displayName} />
            </Field>
            <Field id="pt-acct" label="Account number">
              <span className="flex gap-2">
                <Input
                  id="pt-acct"
                  readOnly
                  value={reveal ? "0012 9876 5432" : "•••• •••• 5432"}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="secondary"
                  aria-pressed={reveal}
                  onClick={() => {
                    setReveal((v) => !v);
                    if (!reveal) toast("Reveal recorded in the audit log");
                  }}
                >
                  {reveal ? "Hide" : "Reveal"}
                </Button>
              </span>
            </Field>
            <Field id="pt-ifsc" label="IFSC">
              <Input id="pt-ifsc" defaultValue="HDFC0000123" className="font-mono" />
            </Field>
            <Field id="pt-bank" label="Bank name">
              <Input id="pt-bank" defaultValue="HDFC Bank" />
            </Field>
            <div className="flex items-center gap-2">
              <Switch id="pt-active" defaultChecked />
              <Label htmlFor="pt-active">Active</Label>
            </div>
          </form>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setPartnerSheet(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success("Partner updated");
                setPartnerSheet(null);
              }}
            >
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={securityOpen} onOpenChange={setSecurityOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Security</DialogTitle>
            <DialogDescription>
              Set up TOTP with your authenticator app. Backup codes download once; store them
              somewhere safe — each works once.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div
              className="grid size-40 place-items-center rounded-md bg-inverse-fg text-caption text-inverse"
              aria-label="TOTP QR code (white tile)"
            >
              QR
            </div>
            <div className="space-y-3">
              <Field id="totp-secret" label="Manual secret">
                <Input
                  id="totp-secret"
                  readOnly
                  value="JBSW Y3DP EHPK 3PXP"
                  className="font-mono"
                />
              </Field>
              <Field id="totp-code" label="Confirm code" required>
                <Input
                  id="totp-code"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-40 font-mono text-[20px] tracking-widest"
                />
              </Field>
              <p className="text-caption text-fg-muted">
                Active session: Safari · macOS · 103.21.xx.4 · since 06:02 IST
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => toast("Disabling TOTP requires your password and a current code")}
            >
              Disable TOTP
            </Button>
            <Button variant="secondary" onClick={() => toast.success("Backup codes downloaded")}>
              Download backup codes
            </Button>
            <Button
              onClick={() => {
                toast.success("TOTP enabled");
                setSecurityOpen(false);
              }}
            >
              Enable TOTP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
