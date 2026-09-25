"use client";

import Link from "next/link";
import * as React from "react";
import {
  AlarmClockIcon,
  DownloadIcon,
  KanbanIcon,
  PlusIcon,
  TableIcon,
  TargetIcon,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";
import { DataToolbar, ToolbarField } from "../DataToolbar";
import { EmptyState } from "../EmptyState";
import { daysUntil, formatDate, initials, money, timeAgo } from "../format";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { AdminUserRef, LeadRow, LeadStatus } from "../types";

const STAGES: LeadStatus[] = ["new", "contacted", "qualified", "proposal", "won", "lost"];
const STAGE_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};
const LOST_REASONS = ["Budget", "Timing", "Went elsewhere", "No response", "Not a fit", "Other"];

export interface LeadsScreenProps {
  leads: LeadRow[];
  admins: AdminUserRef[];
  currentUser: AdminUserRef;
  now: string;
  detailHref: string;
  newOrderHref: string;
  initialView?: "table" | "board";
}

/** Follow-up chip: red with the number of days when overdue (D-706). */
export function FollowUpChip({ at, now }: { at?: string; now: string }) {
  if (!at) return <span className="text-fg-subtle">—</span>;
  const days = daysUntil(at, now);
  if (days < 0) {
    return (
      <StatusBadge
        kind="leads.follow_up"
        value="overdue"
        size="sm"
        label={`Overdue by ${-days} day${-days === 1 ? "" : "s"}`}
      />
    );
  }
  return <span className="text-body-sm">{days === 0 ? "Today" : formatDate(at)}</span>;
}

/**
 * SCR-ADM-13 — leads: table and kanban board over the same data with a Table/Board toggle,
 * toolbar filters, bulk assign, claim from pool, and Won/Lost dialogs. Drag-and-drop (dnd-kit)
 * is replaced by the "Move to…" menu until Phase 8 wires the sensors.
 */
export function LeadsScreen({
  leads: initial,
  admins,
  currentUser,
  now,
  detailHref,
  newOrderHref,
  initialView = "table",
}: LeadsScreenProps) {
  const [leads, setLeads] = React.useState(initial);
  const [view, setView] = React.useState(initialView);
  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [lostOpen, setLostOpen] = React.useState<LeadRow | null>(null);
  const [wonOpen, setWonOpen] = React.useState<LeadRow | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [showLost, setShowLost] = React.useState(false);

  const isOverdue = (l: LeadRow) =>
    Boolean(l.nextFollowUpAt && daysUntil(l.nextFollowUpAt, now) < 0);
  const rows = leads
    .filter((l) => (overdueOnly ? isOverdue(l) : true))
    .filter((l) => (view === "table" ? l.status !== "won" && l.status !== "lost" : true));

  const move = (lead: LeadRow, status: LeadStatus) => {
    if (status === "won") return setWonOpen(lead);
    if (status === "lost") return setLostOpen(lead);
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    toast.success(`Moved to ${STAGE_LABEL[status]}`, {
      action: {
        label: "Undo",
        onClick: () =>
          setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status: lead.status } : l))),
      },
    });
  };
  const claim = (lead: LeadRow) => {
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, assignee: currentUser } : l)));
    toast.success(`Assigned to ${currentUser.name.split(" ")[0]}`);
  };

  return (
    <>
      <PageHeader
        title="Leads"
        actions={
          <>
            <div
              role="group"
              aria-label="View"
              className="inline-flex rounded-md border border-border bg-surface p-[3px]"
            >
              {(["table", "board"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-body-sm font-medium",
                    view === v ? "bg-elevated text-fg shadow-1" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {v === "table" ? (
                    <TableIcon aria-hidden className="size-4" />
                  ) : (
                    <KanbanIcon aria-hidden className="size-4" />
                  )}
                  {v === "table" ? "Table" : "Board"}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm">
              <DownloadIcon aria-hidden /> Export CSV
            </Button>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <PlusIcon aria-hidden /> New lead
            </Button>
          </>
        }
      />
      <DataToolbar
        searchId="leads-search"
        searchPlaceholder="Name, email, company…"
        filters={
          <>
            <ToolbarField id="leads-source" label="Source">
              <Select>
                <SelectTrigger id="leads-source" size="sm" className="w-36">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inquiry_form">Inquiry form</SelectItem>
                  <SelectItem value="product_cta">Product CTA</SelectItem>
                  <SelectItem value="chatbot">Chatbot</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </ToolbarField>
            <ToolbarField id="leads-assigned" label="Assigned">
              <Select>
                <SelectTrigger id="leads-assigned" size="sm" className="w-40">
                  <SelectValue placeholder="Anyone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Me</SelectItem>
                  <SelectItem value="pool">Unassigned pool</SelectItem>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ToolbarField>
            <ToolbarField id="leads-priority" label="Priority">
              <Select>
                <SelectTrigger id="leads-priority" size="sm" className="w-28">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </ToolbarField>
            <div className="flex h-8 items-center gap-2 self-end">
              <Switch
                id="leads-overdue"
                size="sm"
                checked={overdueOnly}
                onCheckedChange={setOverdueOnly}
              />
              <Label htmlFor="leads-overdue">Overdue only</Label>
            </div>
          </>
        }
      />
      {selected.size > 0 ? (
        <div
          role="status"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-accent bg-accent-soft px-3 py-2 text-body-sm"
        >
          <span className="font-medium text-accent-text">{selected.size} selected</span>
          <Label htmlFor="bulk-assign" className="sr-only">
            Assign to
          </Label>
          <Select
            onValueChange={(v) => {
              toast.success(
                `Assigned ${selected.size} leads to ${admins.find((a) => a.id === v)?.name ?? v}`,
              );
              setSelected(new Set());
            }}
          >
            <SelectTrigger id="bulk-assign" size="sm" className="w-40">
              <SelectValue placeholder="Assign to…" />
            </SelectTrigger>
            <SelectContent>
              {admins.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="secondary">
            Set priority
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      {view === "table" ? (
        rows.length === 0 ? (
          <EmptyState
            icon={TargetIcon}
            title="No leads yet"
            body="They'll appear here from the inquiry form, product pages and the assistant."
          />
        ) : (
          <div className="rounded-lg border border-border bg-surface">
            <Table>
              <TableCaption className="sr-only">Leads</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all leads"
                      checked={
                        rows.every((r) => selected.has(r.id))
                          ? true
                          : selected.size > 0
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(v) =>
                        setSelected(v === true ? new Set(rows.map((r) => r.id)) : new Set())
                      }
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Next follow-up</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow
                    key={l.id}
                    className={cn(isOverdue(l) && "border-l-2 border-l-danger")}
                    data-state={selected.has(l.id) ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${l.name}`}
                        checked={selected.has(l.id)}
                        onCheckedChange={(v) =>
                          setSelected((p) => {
                            const n = new Set(p);
                            if (v === true) n.add(l.id);
                            else n.delete(l.id);
                            return n;
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={detailHref} className="font-medium hover:text-accent-text">
                        {l.name}
                      </Link>
                      {l.company ? (
                        <span className="block text-caption text-fg-muted">{l.company}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-fg-muted">
                      {l.email}
                      {l.phone ? <span className="block text-caption">{l.phone}</span> : null}
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        <StatusBadge kind="leads.source" value={l.source} size="sm" />
                        {l.product ? (
                          <Badge tone="ghost" size="sm">
                            {l.product}
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {l.services.map((s) => (
                          <Badge key={s} tone="neutral" size="sm">
                            {s}
                          </Badge>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="leads.status" value={l.status} />
                    </TableCell>
                    <TableCell>
                      {l.assignee ? (
                        <span className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback>{initials(l.assignee.name)}</AvatarFallback>
                          </Avatar>
                          {l.assignee.name.split(" ")[0]}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Badge tone="ghost" size="sm" title="Unassigned — claim to work it">
                            Pool
                          </Badge>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7"
                            onClick={() => claim(l)}
                          >
                            Claim
                          </Button>
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <FollowUpChip at={l.nextFollowUpAt} now={now} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="leads.priority" value={l.priority} size="sm" />
                    </TableCell>
                    <TableCell className="text-fg-muted">{timeAgo(l.createdAt, now)}</TableCell>
                    <TableCell>
                      <RowActions
                        label={`Actions for ${l.name}`}
                        actions={[
                          { label: "Open", href: detailHref },
                          { label: l.assignee ? "Assign…" : "Claim", onSelect: () => claim(l) },
                          { label: "Set follow-up" },
                          {
                            label: "Change status",
                            onSelect: () =>
                              move(
                                l,
                                STAGES[Math.min(STAGES.indexOf(l.status) + 1, 3)] ?? l.status,
                              ),
                          },
                          {
                            label: "Mark lost",
                            destructive: true,
                            separatorBefore: true,
                            onSelect: () => setLostOpen(l),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : (
        <div className="grid gap-3 overflow-x-auto lg:grid-cols-6">
          {STAGES.map((stage) => {
            const col = rows.filter((l) => l.status === stage);
            const collapsed = stage === "lost" && !showLost;
            const wonValue =
              stage === "won" ? col.reduce((s, l) => s + (l.wonValue?.amountMinor ?? 0), 0) : 0;
            return (
              <section
                key={stage}
                aria-labelledby={`col-${stage}`}
                className="min-w-0 rounded-lg border border-border bg-surface"
              >
                <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <h2
                    id={`col-${stage}`}
                    className="flex items-center gap-2 text-body-sm font-semibold"
                  >
                    {STAGE_LABEL[stage]}{" "}
                    <span className="rounded-full bg-elevated px-1.5 font-mono text-caption text-fg-muted">
                      {col.length}
                    </span>
                  </h2>
                  {stage === "won" && wonValue > 0 ? (
                    <span className="font-mono text-caption tnum text-success">
                      {money({ amountMinor: wonValue, currency: "USD" })}
                    </span>
                  ) : null}
                  {stage === "lost" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6"
                      aria-expanded={showLost}
                      onClick={() => setShowLost((v) => !v)}
                    >
                      {showLost ? "Collapse" : "Expand"}
                    </Button>
                  ) : null}
                </header>
                {collapsed ? null : (
                  <ul className="space-y-2 p-2">
                    {col.map((l) => (
                      <li key={l.id}>
                        <div
                          className={cn(
                            "space-y-1.5 rounded-md border border-border bg-canvas p-3",
                            isOverdue(l) && "border-l-2 border-l-danger",
                          )}
                        >
                          <Link
                            href={detailHref}
                            className="block text-body-sm font-semibold hover:text-accent-text"
                          >
                            {l.name}
                          </Link>
                          {l.company ? (
                            <p className="text-caption text-fg-muted">{l.company}</p>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-1">
                            <StatusBadge kind="leads.source" value={l.source} size="sm" hideIcon />
                            {l.product ? (
                              <Badge tone="ghost" size="sm">
                                {l.product}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <FollowUpChip at={l.nextFollowUpAt} now={now} />
                            <span className="flex items-center gap-1.5">
                              <span
                                aria-hidden
                                className={cn(
                                  "size-2 rounded-full",
                                  l.priority === "high"
                                    ? "bg-danger"
                                    : l.priority === "normal"
                                      ? "bg-fg-subtle"
                                      : "bg-border-strong",
                                )}
                              />
                              <span className="sr-only">Priority {l.priority}</span>
                              {l.assignee ? (
                                <Avatar size="sm">
                                  <AvatarFallback>{initials(l.assignee.name)}</AvatarFallback>
                                </Avatar>
                              ) : (
                                <Badge tone="ghost" size="sm">
                                  Pool
                                </Badge>
                              )}
                            </span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-full justify-start"
                              >
                                Move to…
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {STAGES.filter((s) => s !== stage).map((s) => (
                                <DropdownMenuItem key={s} onSelect={() => move(l, s)}>
                                  {STAGE_LABEL[s]}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </li>
                    ))}
                    {col.length === 0 ? (
                      <li className="px-2 py-4 text-center text-caption text-fg-subtle">Empty</li>
                    ) : null}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={lostOpen !== null} onOpenChange={(o) => !o && setLostOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {lostOpen?.name} as Lost</DialogTitle>
            <DialogDescription>A reason is required.</DialogDescription>
          </DialogHeader>
          <Field id="lost-reason" label="Reason" required>
            <Select defaultValue="Budget">
              <SelectTrigger id="lost-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="lost-note" label="Note" optional>
            <Textarea id="lost-note" rows={2} />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (lostOpen)
                  setLeads((ls) =>
                    ls.map((l) => (l.id === lostOpen.id ? { ...l, status: "lost" } : l)),
                  );
                toast.success("Marked lost");
                setLostOpen(null);
              }}
            >
              Mark lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={wonOpen !== null} onOpenChange={(o) => !o && setWonOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {wonOpen?.name} as Won</DialogTitle>
            <DialogDescription>
              Optionally link the order, or create a project order prefilled from this lead.
            </DialogDescription>
          </DialogHeader>
          <Field id="won-order" label="Order" optional>
            <Input id="won-order" placeholder="CK-ORD-…" className="font-mono" />
          </Field>
          <DialogFooter>
            <Button asChild variant="secondary">
              <Link href={newOrderHref}>Create project order</Link>
            </Button>
            <Button
              onClick={() => {
                if (wonOpen)
                  setLeads((ls) =>
                    ls.map((l) => (l.id === wonOpen.id ? { ...l, status: "won" } : l)),
                  );
                toast.success("Marked won");
                setWonOpen(null);
              }}
            >
              Mark won
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={newOpen} onOpenChange={setNewOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New lead</SheetTitle>
            <SheetDescription>Source is fixed to Manual.</SheetDescription>
          </SheetHeader>
          <form className="space-y-4 px-4" onSubmit={(e) => e.preventDefault()}>
            <Field id="nl-name" label="Name" required>
              <Input id="nl-name" required aria-required />
            </Field>
            <Field id="nl-email" label="Email" required>
              <Input id="nl-email" type="email" required aria-required />
            </Field>
            <Field id="nl-phone" label="Phone" optional>
              <Input id="nl-phone" type="tel" />
            </Field>
            <Field id="nl-company" label="Company" optional>
              <Input id="nl-company" />
            </Field>
            <Field id="nl-service" label="Service interest">
              <Input id="nl-service" placeholder="Custom software, Integrations…" />
            </Field>
            <Field id="nl-product" label="Product" optional>
              <Select>
                <SelectTrigger id="nl-product">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fitdesk">FitDesk Pro</SelectItem>
                  <SelectItem value="tradeflow">TradeFlow</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id="nl-message" label="Message">
              <Textarea id="nl-message" rows={3} />
            </Field>
            <Field id="nl-priority" label="Priority">
              <Select defaultValue="normal">
                <SelectTrigger id="nl-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-2">
              <Switch id="nl-assign-me" defaultChecked />
              <Label htmlFor="nl-assign-me">Assign to me</Label>
            </div>
          </form>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success("Lead created");
                setNewOpen(false);
              }}
            >
              Create lead
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <p className="mt-3 flex items-center gap-1 text-caption text-fg-subtle">
        <AlarmClockIcon aria-hidden className="size-3.5" /> Overdue follow-ups show the days overdue
        in text and a red left rule.
      </p>
    </>
  );
}
