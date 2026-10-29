"use client";

import { ExportMenu } from "@/components/admin/ExportMenu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  BadgeCheckIcon,
  FilterIcon,
  MessageSquareIcon,
  ShoppingCartIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { reinstateCustomer, suspendCustomer } from "@/modules/users/admin-mutations";
import { bulkSummary, runBulk } from "@/lib/admin/bulk";
import { BulkActionBar } from "../BulkActionBar";
import { NewCustomerDialog } from "./NewCustomerDialog";
import { AccessDialog } from "../system/AccessDialog";
import { DataToolbar, ToolbarField } from "../DataToolbar";
import { EmptyState } from "../EmptyState";
import { formatDate, initials, inr, timeAgo } from "../format";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { CustomerRow } from "../types";

export interface CustomersListProps {
  customers: CustomerRow[];
  now: string;
  detailHref: string;
  quotesHref: string;
  newOrderHref: string;
}

interface StatusDialogState {
  customers: CustomerRow[];
  mode: "suspend" | "reinstate";
}

/** SCR-ADM-10 — customers list with status/tag/country filters and gated row actions. */
export function CustomersList({
  customers,
  now,
  detailHref,
  quotesHref,
  newOrderHref,
}: CustomersListProps) {
  const router = useRouter();
  const [statusDialog, setStatusDialog] = React.useState<StatusDialogState | null>(null);
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [accessFor, setAccessFor] = React.useState<CustomerRow | null>(null);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const eligible = customers.filter((c) => c.status !== "deleted");
  const picked = customers.filter((c) => selected.has(c.id));
  const openBulk = (mode: StatusDialogState["mode"]) => {
    // Only rows the single-row action would allow: suspend active, reinstate suspended.
    const targets = picked.filter((c) =>
      mode === "suspend" ? c.status === "active" : c.status === "suspended",
    );
    if (targets.length === 0) {
      toast.error(
        `None of the selected customers can be ${mode === "suspend" ? "suspended" : "reinstated"}.`,
      );
      return;
    }
    setReason("");
    setStatusDialog({ customers: targets, mode });
  };

  async function confirmStatusChange() {
    if (!statusDialog) return;
    if (reason.trim().length === 0) {
      toast.error("A reason is required.");
      return;
    }
    setSubmitting(true);
    const run = statusDialog.mode === "suspend" ? suspendCustomer : reinstateCustomer;
    const result = await runBulk(
      statusDialog.customers.map((c) => c.id),
      (userId) => run({ userId, reason: reason.trim() }),
    ).catch((err: Error) => err);
    setSubmitting(false);

    if (result instanceof Error) {
      toast.error(result.message);
      return;
    }
    const verb = statusDialog.mode === "suspend" ? "Suspended" : "Reinstated";
    if (result.done.length === 0) {
      // Nothing changed: keep the dialog open so the reason is not lost.
      toast.error(result.failed[0]?.message ?? "Failed");
      return;
    }
    if (result.failed.length > 0) toast.error(bulkSummary(verb, "customer", result));
    else if (statusDialog.customers.length === 1)
      toast.success(`${statusDialog.customers[0]?.name} ${verb.toLowerCase()}`);
    else toast.success(bulkSummary(verb, "customer", result));
    setSelected(new Set());
    setStatusDialog(null);
    setReason("");
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Customers"
        titleAdornment={<Badge tone="neutral">{customers.length}</Badge>}
        actions={
          <>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <UserPlusIcon aria-hidden /> New customer
            </Button>
            <ExportMenu
              name="customers"
              columns={[
                { header: "Name" },
                { header: "Email" },
                { header: "Company" },
                { header: "Country" },
                { header: "Status" },
                { header: "Orders open", type: "int" },
                { header: "Lifetime spend INR", type: "money" },
                { header: "Joined", type: "date" },
              ]}
              rows={customers.map((c) => [
                c.name,
                c.email,
                c.company,
                c.country,
                c.status,
                c.openOrders,
                (c.lifetimeSpendInr / 100).toFixed(2),
                c.joinedAt,
              ])}
            />
          </>
        }
      />
      <AccessDialog
        open={accessFor !== null}
        onOpenChange={(o) => !o && setAccessFor(null)}
        target={accessFor ? { userId: accessFor.id, label: accessFor.name } : null}
      />
      <NewCustomerDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => router.refresh()}
      />
      <DataToolbar
        searchId="customers-search"
        searchPlaceholder="Name, email, company…"
        filters={
          <>
            <ToolbarField id="cust-status" label="Status">
              <Select>
                <SelectTrigger id="cust-status" size="sm" className="w-32">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </ToolbarField>
            <ToolbarField id="cust-tag" label="Tag">
              <Select>
                <SelectTrigger id="cust-tag" size="sm" className="w-32">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {["vip", "b2b", "project", "eu", "designer", "chargeback"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ToolbarField>
            <ToolbarField id="cust-country" label="Country">
              <Select>
                <SelectTrigger id="cust-country" size="sm" className="w-28">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">IN</SelectItem>
                  <SelectItem value="DE">DE</SelectItem>
                </SelectContent>
              </Select>
            </ToolbarField>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="self-end">
                  <FilterIcon aria-hidden /> More
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="f-open-order" />
                  <Label htmlFor="f-open-order">Has open order</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="f-sub" />
                  <Label htmlFor="f-sub">Has active subscription</Label>
                </div>
              </PopoverContent>
            </Popover>
          </>
        }
      />
      <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button size="sm" variant="secondary" onClick={() => openBulk("suspend")}>
          Suspend selected
        </Button>
        <Button size="sm" variant="secondary" onClick={() => openBulk("reinstate")}>
          Reinstate selected
        </Button>
      </BulkActionBar>
      {customers.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No customers match" />
      ) : (
        <div className="rounded-lg border border-border bg-surface">
          <Table>
            <TableCaption className="sr-only">Customers</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all customers"
                    checked={
                      eligible.length > 0 && eligible.every((c) => selected.has(c.id))
                        ? true
                        : selected.size > 0
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(v) =>
                      setSelected(v === true ? new Set(eligible.map((c) => c.id)) : new Set())
                    }
                  />
                </TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Company / country</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">Lifetime spend</TableHead>
                <TableHead>Open items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id} data-state={selected.has(c.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${c.name}`}
                      disabled={c.status === "deleted"}
                      checked={selected.has(c.id)}
                      onCheckedChange={(v) =>
                        setSelected((p) => {
                          const n = new Set(p);
                          if (v === true) n.add(c.id);
                          else n.delete(c.id);
                          return n;
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`${detailHref}/${c.id}`}
                      className="flex items-center gap-3 hover:text-accent-text"
                    >
                      <Avatar>
                        <AvatarFallback>{initials(c.name)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 font-medium">
                          {c.name}
                          {c.verified ? (
                            <>
                              <BadgeCheckIcon aria-hidden className="size-4 text-success" />
                              <span className="sr-only">(verified)</span>
                            </>
                          ) : null}
                        </span>
                        <span className="block truncate text-caption text-fg-muted">{c.email}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-fg-muted">
                    {c.company ?? "—"} · {c.country}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <Badge key={t} tone="neutral" size="sm">
                          {t}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tnum">
                    {c.activeEntitlements}
                  </TableCell>
                  <TableCell className="text-right font-mono tnum">
                    {inr(c.lifetimeSpendInr)}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-3 text-caption text-fg-muted">
                      <span className="inline-flex items-center gap-1">
                        <ShoppingCartIcon aria-hidden className="size-3.5" />
                        {c.openOrders} <span className="sr-only">pending orders</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquareIcon aria-hidden className="size-3.5" />
                        {c.openQueries} <span className="sr-only">open queries</span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="users.status" value={c.status} />
                    {c.anonymisedAt ? (
                      <span className="block text-caption text-fg-muted">
                        anonymised {formatDate(c.anonymisedAt)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-fg-muted">{formatDate(c.joinedAt)}</TableCell>
                  <TableCell className="text-fg-muted">
                    {c.lastSeenAt ? timeAgo(c.lastSeenAt, now) : "—"}
                  </TableCell>
                  <TableCell>
                    <RowActions
                      label={`Actions for ${c.name}`}
                      actions={[
                        { label: "Open", href: `${detailHref}/${c.id}` },
                        {
                          label: "Reset link / password",
                          onSelect: () => setAccessFor(c),
                          disabled: c.status === "deleted",
                        },
                        {
                          label: c.status === "suspended" ? "Reinstate" : "Suspend",
                          onSelect: () => {
                            setReason("");
                            setStatusDialog({
                              customers: [c],
                              mode: c.status === "suspended" ? "reinstate" : "suspend",
                            });
                          },
                          disabled: c.status === "deleted",
                          destructive: c.status !== "suspended",
                        },
                        {
                          label: "New quote",
                          href: quotesHref,
                          separatorBefore: true,
                          disabled: c.status !== "active",
                        },
                        {
                          label: "New manual order",
                          href: newOrderHref,
                          disabled: c.status !== "active",
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={statusDialog !== null} onOpenChange={(o) => !o && setStatusDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusDialog?.mode === "suspend" ? "Suspend" : "Reinstate"}{" "}
              {statusDialog?.customers.length === 1
                ? statusDialog.customers[0]?.name
                : `${statusDialog?.customers.length ?? 0} customers`}
              ?
            </DialogTitle>
            <DialogDescription>
              {statusDialog?.mode === "suspend"
                ? "Suspending signs the customer out and blocks purchases, downloads and chat. Existing invoices remain."
                : "Reinstating restores purchases, downloads and chat access."}{" "}
              Add a reason (logged).
            </DialogDescription>
          </DialogHeader>
          <Field id="status-reason" label="Reason" required>
            <Textarea
              id="status-reason"
              rows={2}
              required
              aria-required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant={statusDialog?.mode === "suspend" ? "destructive" : "secondary"}
              onClick={() => void confirmStatusChange()}
              disabled={submitting}
            >
              {statusDialog?.mode === "suspend" ? "Suspend" : "Reinstate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
