"use client";

import Link from "next/link";
import * as React from "react";
import { ChevronDownIcon, KeyRoundIcon, TruckIcon } from "lucide-react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";
import { STATUS_ENUMS } from "@/lib/status-tone";
import { DataToolbar, ToolbarField } from "../DataToolbar";
import { EmptyState } from "../EmptyState";
import { FilterChips } from "../FilterChips";
import { formatDate, hoursSince, timeAgo } from "../format";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { AdminUserRef, DeliveryTaskRow, EntitlementRow } from "../types";

export interface EntitlementsScreenProps {
  entitlements: EntitlementRow[];
  tasks: DeliveryTaskRow[];
  admins: AdminUserRef[];
  now: string;
  orderHref: string;
  customerHref: string;
  queriesHref: string;
  initialView?: "entitlements" | "tasks";
}

/** SCR-ADM-12 — entitlements list and the delivery-task queue (provision / revoke external). */
export function EntitlementsScreen({
  entitlements,
  tasks,
  admins,
  now,
  orderHref,
  customerHref,
  queriesHref,
  initialView = "entitlements",
}: EntitlementsScreenProps) {
  const [view, setView] = React.useState(initialView);
  const [status, setStatus] = React.useState<EntitlementRow["status"] | null>("active");
  const [expiring, setExpiring] = React.useState(false);
  const [capReached, setCapReached] = React.useState(false);
  const [taskTab, setTaskTab] = React.useState<"open" | "done">("open");
  const [kind, setKind] = React.useState<DeliveryTaskRow["kind"] | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [doneTask, setDoneTask] = React.useState<DeliveryTaskRow | null>(null);

  const rows = entitlements
    .filter((e) => (status ? e.status === status : true))
    .filter((e) =>
      expiring
        ? Boolean(
            e.accessEnds &&
            hoursSince(e.accessEnds, now) > -24 * 30 &&
            hoursSince(e.accessEnds, now) < 0,
          )
        : true,
    )
    .filter((e) =>
      capReached ? Boolean(e.downloadCap && e.downloadsUsed === e.downloadCap) : true,
    );
  const taskRows = tasks
    .filter((t) => t.status === taskTab)
    .filter((t) => (kind ? t.kind === kind : true));

  return (
    <>
      <PageHeader
        title={view === "entitlements" ? "Entitlements" : "Delivery tasks"}
        description={
          view === "entitlements"
            ? "Every entitlement across customers. Service checklists are worked on the order detail."
            : "Tasks the platform raises when a human must act: provision an account or disable an external one."
        }
        actions={
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
              <TabsTrigger value="tasks">
                Delivery tasks ({tasks.filter((t) => t.status === "open").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {view === "entitlements" ? (
        <>
          <FilterChips
            label="Filter by status"
            chips={STATUS_ENUMS["entitlements.status"].map((s) => ({
              value: s,
              label: s.charAt(0).toUpperCase() + s.slice(1),
              count: entitlements.filter((e) => e.status === s).length,
            }))}
            value={status}
            onChange={setStatus}
          />
          <div className="mt-4">
            <DataToolbar
              searchId="ent-search"
              searchPlaceholder="Customer, product…"
              filters={
                <>
                  <ToolbarField id="ent-type" label="Type">
                    <Select>
                      <SelectTrigger id="ent-type" size="sm" className="w-32">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ENUMS["entitlements.delivery_type"].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ToolbarField>
                  <div className="flex h-8 items-center gap-2 self-end">
                    <Switch
                      id="ent-expiring"
                      size="sm"
                      checked={expiring}
                      onCheckedChange={setExpiring}
                    />
                    <Label htmlFor="ent-expiring">Expiring in 30 days</Label>
                  </div>
                  <div className="flex h-8 items-center gap-2 self-end">
                    <Switch
                      id="ent-cap"
                      size="sm"
                      checked={capReached}
                      onCheckedChange={setCapReached}
                    />
                    <Label htmlFor="ent-cap">Cap reached</Label>
                  </div>
                </>
              }
            />
            {rows.length === 0 ? (
              <EmptyState icon={KeyRoundIcon} title="No entitlements match" />
            ) : (
              <div className="rounded-lg border border-border bg-surface">
                <Table>
                  <TableCaption className="sr-only">Entitlements</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product · offering</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Access ends</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Downloads</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Provisioning</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Link href={customerHref} className="hover:text-accent-text">
                            {e.customer.name}
                          </Link>
                          <span className="block text-caption text-fg-muted">
                            {e.customer.email}
                          </span>
                        </TableCell>
                        <TableCell>
                          {e.product} <span className="text-fg-muted">· {e.offering}</span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="entitlements.delivery_type" value={e.type} size="sm" />
                        </TableCell>
                        <TableCell>
                          <span className="flex flex-wrap gap-1">
                            <StatusBadge kind="entitlements.status" value={e.status} size="sm" />
                            {e.status === "active" && e.provisioning === "pending" ? (
                              <StatusBadge
                                kind="entitlements.provisioning_state"
                                value="pending"
                                size="sm"
                              />
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="text-fg-muted">
                          {e.accessEnds ? formatDate(e.accessEnds) : "Lifetime"}
                        </TableCell>
                        <TableCell>
                          {e.subscription ? (
                            <span className="flex flex-wrap items-center gap-1 text-caption">
                              <StatusBadge
                                kind="offerings.billing_interval"
                                value={e.subscription.interval}
                                size="sm"
                              />
                              <span className="text-fg-muted">
                                {formatDate(e.subscription.periodEnd)}
                              </span>
                              <StatusBadge
                                kind="subscriptions.status"
                                value={e.subscription.status}
                                size="sm"
                              />
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="font-mono tnum">
                          {e.downloadCap ? (
                            <span
                              className={cn(e.downloadsUsed === e.downloadCap && "text-warning")}
                            >
                              {e.downloadsUsed}/{e.downloadCap}
                              {e.downloadsUsed === e.downloadCap ? (
                                <Link
                                  href={queriesHref}
                                  className="ml-1 font-body text-caption text-accent-text hover:underline"
                                >
                                  reset asked?
                                </Link>
                              ) : null}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {e.keyIssued === undefined ? (
                            "—"
                          ) : e.keyIssued ? (
                            <Badge tone="success" size="sm">
                              Issued
                            </Badge>
                          ) : (
                            <Badge tone="warning" size="sm">
                              Not issued
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            kind="entitlements.provisioning_state"
                            value={e.provisioning}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell>
                          {e.orderNumber === "—" ? (
                            <span className="text-fg-subtle">manual grant</span>
                          ) : (
                            <Link
                              href={orderHref}
                              className="font-mono text-accent-text hover:underline"
                            >
                              {e.orderNumber}
                            </Link>
                          )}
                        </TableCell>
                        <TableCell>
                          <RowActions
                            label={`Actions for ${e.customer.name} · ${e.product}`}
                            actions={[
                              { label: "Open order", href: orderHref },
                              { label: "Enter key", disabled: e.keyIssued !== false },
                              { label: "Mark provisioned", disabled: e.provisioning !== "pending" },
                              { label: "Reset downloads", disabled: !e.downloadCap },
                              { label: "Extend" },
                              { label: "Cancel subscription", disabled: !e.subscription },
                              {
                                label: "Revoke",
                                destructive: true,
                                separatorBefore: true,
                                disabled: e.status === "revoked",
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
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <Tabs value={taskTab} onValueChange={(v) => setTaskTab(v as typeof taskTab)}>
              <TabsList>
                <TabsTrigger value="open">
                  Open ({tasks.filter((t) => t.status === "open").length})
                </TabsTrigger>
                <TabsTrigger value="done">
                  Done ({tasks.filter((t) => t.status === "done").length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="open" className="sr-only">
                Open tasks
              </TabsContent>
              <TabsContent value="done" className="sr-only">
                Done tasks
              </TabsContent>
            </Tabs>
            <FilterChips
              label="Filter by kind"
              chips={[
                {
                  value: "provision",
                  label: "Provision",
                  count: tasks.filter((t) => t.kind === "provision" && t.status === taskTab).length,
                },
                {
                  value: "revoke_external",
                  label: "Revoke external",
                  count: tasks.filter((t) => t.kind === "revoke_external" && t.status === taskTab)
                    .length,
                },
              ]}
              value={kind}
              onChange={setKind}
            />
          </div>
          {taskRows.length === 0 ? (
            <EmptyState icon={TruckIcon} title="No open delivery tasks" className="mt-4" />
          ) : (
            <div className="mt-4 rounded-lg border border-border bg-surface">
              <Table>
                <TableCaption className="sr-only">Delivery tasks</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <span className="sr-only">Expand</span>
                    </TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product · offering</TableHead>
                    <TableHead>Entitlement</TableHead>
                    <TableHead>Assigned to</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskRows.map((t) => {
                    const age = hoursSince(t.createdAt, now);
                    const old = age > 48;
                    const open = expanded === t.id;
                    return (
                      <React.Fragment key={t.id}>
                        <TableRow>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-expanded={open}
                              aria-controls={`task-${t.id}`}
                              aria-label={`${open ? "Collapse" : "Expand"} task for ${t.customer.name}`}
                              onClick={() => setExpanded(open ? null : t.id)}
                            >
                              <ChevronDownIcon
                                aria-hidden
                                className={cn("size-4 transition-transform", open && "rotate-180")}
                              />
                            </Button>
                          </TableCell>
                          <TableCell className="text-fg-muted">{formatDate(t.createdAt)}</TableCell>
                          <TableCell>
                            <StatusBadge kind="delivery_tasks.kind" value={t.kind} size="sm" />
                          </TableCell>
                          <TableCell>
                            <Link href={customerHref} className="hover:text-accent-text">
                              {t.customer.name}
                            </Link>
                            <span className="block text-caption text-fg-muted">
                              {t.customer.email}
                            </span>
                          </TableCell>
                          <TableCell>
                            {t.product} <span className="text-fg-muted">· {t.offering}</span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              kind="entitlements.status"
                              value={t.entitlementStatus}
                              size="sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Label htmlFor={`assign-${t.id}`} className="sr-only">
                              Assign task
                            </Label>
                            <Select defaultValue={t.assignedTo ?? "none"}>
                              <SelectTrigger id={`assign-${t.id}`} size="sm" className="w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Unassigned</SelectItem>
                                {admins.map((a) => (
                                  <SelectItem key={a.id} value={a.name}>
                                    {a.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="max-w-56 truncate text-fg-muted">
                            {t.note ?? "—"}
                          </TableCell>
                          <TableCell className={cn(old && t.status === "open" && "text-danger")}>
                            {timeAgo(t.createdAt, now)}
                            {old && t.status === "open" ? " · overdue" : ""}
                          </TableCell>
                          <TableCell>
                            <span className="flex gap-1">
                              <Button asChild variant="ghost" size="sm">
                                <Link href={orderHref}>Open order</Link>
                              </Button>
                              {t.status === "open" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setDoneTask(t)}
                                >
                                  Mark done
                                </Button>
                              ) : null}
                            </span>
                          </TableCell>
                        </TableRow>
                        {open ? (
                          <TableRow id={`task-${t.id}`}>
                            <TableCell colSpan={10} className="bg-canvas whitespace-normal">
                              <p className="text-body-sm">
                                <span className="font-semibold">Hints:</span>{" "}
                                {t.hints ??
                                  (t.kind === "revoke_external"
                                    ? `Revoke access in the SaaS for ${t.customer.email}, then mark done.`
                                    : "See the offering's delivery config.")}
                              </p>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <Dialog open={doneTask !== null} onOpenChange={(o) => !o && setDoneTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark task done</DialogTitle>
            <DialogDescription>
              {doneTask?.kind === "revoke_external"
                ? "Confirm the external account was disabled."
                : "Confirm the account was provisioned and credentials sent."}
            </DialogDescription>
          </DialogHeader>
          <Field id="task-note" label="Note" required={doneTask?.kind === "revoke_external"}>
            <Textarea id="task-note" rows={2} />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                toast.success("Task marked done");
                setDoneTask(null);
              }}
            >
              Mark done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
