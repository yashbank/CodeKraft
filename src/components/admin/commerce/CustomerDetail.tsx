"use client";

import Link from "next/link";
import * as React from "react";
import { BadgeCheckIcon } from "lucide-react";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Banner } from "../Banner";
import { Gauge } from "../charts/Gauge";
import { formatDate, formatDateTime, initials, inr, money, timeAgo } from "../format";
import { KeyValue } from "../KeyValue";
import { MoneyCell } from "../MoneyCell";
import { Field } from "../RichTextField";
import { RowActions } from "../RowActions";
import { StatTile } from "../StatTile";
import type { CustomerDetailData } from "../types";

export interface CustomerDetailProps {
  data: CustomerDetailData;
  now: string;
  orderHref: string;
  queriesHref: string;
  quotesHref: string;
  newOrderHref: string;
  auditHref: string;
}

/**
 * SCR-ADM-11 — customer record: header card with tags and status controls, tabs (Overview,
 * Orders, Entitlements, Queries, Activity), side cards for notes/billing/preferences/flags, and
 * the manual grant dialog with a mandatory reason.
 */
export function CustomerDetail({
  data,
  now,
  orderHref,
  queriesHref,
  quotesHref,
  newOrderHref,
  auditHref,
}: CustomerDetailProps) {
  const c = data.customer;
  const [tags, setTags] = React.useState(c.tags);
  const [newTag, setNewTag] = React.useState("");
  const [grantOpen, setGrantOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [notesSaved, setNotesSaved] = React.useState("Saved");
  const deleted = c.status === "deleted";

  return (
    <>
      <section
        aria-label="Customer header"
        className="mb-6 rounded-lg border border-border bg-surface p-5"
      >
        <div className="flex flex-wrap items-start gap-4">
          <Avatar size="lg">
            <AvatarFallback>{initials(c.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="flex items-center gap-2 text-h2">
              {c.name}
              {c.verified ? (
                <>
                  <BadgeCheckIcon aria-hidden className="size-5 text-success" />
                  <span className="sr-only">verified</span>
                </>
              ) : null}
              <StatusBadge kind="users.status" value={c.status} />
            </h1>
            <p className="text-body-sm text-fg-muted">
              {c.email}
              {data.phone ? ` · ${data.phone}` : ""} · {c.country}
              {c.company ? ` · ${c.company}` : ""}
            </p>
            <p className="text-caption text-fg-muted">
              Joined {formatDate(c.joinedAt)} · last seen{" "}
              {c.lastSeenAt ? timeAgo(c.lastSeenAt, now) : "—"}
              {c.anonymisedAt ? ` · anonymised ${formatDate(c.anonymisedAt)}` : ""}
            </p>
            <ul className="flex flex-wrap items-center gap-1.5" aria-label="Tags">
              {tags.map((t) => (
                <li key={t}>
                  <Badge tone="neutral" className="gap-1 pr-1">
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove tag ${t}`}
                      onClick={() => setTags((l) => l.filter((x) => x !== t))}
                      className="grid size-4 place-items-center rounded-full hover:bg-danger-soft hover:text-danger"
                    >
                      ×
                    </button>
                  </Badge>
                </li>
              ))}
              <li>
                <Label htmlFor="cust-new-tag" className="sr-only">
                  Add tag
                </Label>
                <Input
                  id="cust-new-tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTag.trim()) {
                      setTags((l) => [...l, newTag.trim()]);
                      setNewTag("");
                    }
                    if (e.key === "Backspace" && newTag === "" && tags.length > 0)
                      setTags((l) => l.slice(0, -1));
                  }}
                  placeholder="Add tag"
                  className="h-6 w-24 px-2 text-caption"
                  disabled={deleted}
                />
              </li>
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={deleted}
              onClick={() => toast.success("Reset link sent")}
            >
              Send reset link
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={deleted}
              onClick={() => toast.success("One-time login link sent · expires in 15 min")}
            >
              Send one-time login link
            </Button>
            <Button
              variant={c.status === "suspended" ? "secondary" : "destructive"}
              size="sm"
              disabled={deleted}
            >
              {c.status === "suspended" ? "Reinstate" : "Suspend"}
            </Button>
            <RowActions
              label="More customer actions"
              actions={[
                { label: "New quote", href: quotesHref, disabled: deleted },
                { label: "New manual order", href: newOrderHref, disabled: deleted },
                { label: "Grant access", onSelect: () => setGrantOpen(true), disabled: deleted },
                { label: "Export data", separatorBefore: true },
              ]}
            />
          </div>
        </div>
        {data.flags.suspensionReason ? (
          <Banner tone="warning" className="mt-4">
            Suspended: {data.flags.suspensionReason}
          </Banner>
        ) : null}
        {data.flags.chargeback ? (
          <Banner tone="danger" className="mt-4">
            Chargeback flagged.
          </Banner>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="orders">Orders ({data.orders.length})</TabsTrigger>
              <TabsTrigger value="entitlements">
                Entitlements ({data.entitlements.length})
              </TabsTrigger>
              <TabsTrigger value="queries">Queries ({data.queries.length})</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <StatTile label="Lifetime spend" value={inr(data.stats.lifetimeSpendInr)} />
                <StatTile label="Orders" value={data.stats.orders} />
                <StatTile label="Active entitlements" value={data.stats.activeEntitlements} />
                <StatTile label="Open queries" value={data.stats.openQueries} />
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <h2 className="mb-2 text-h4">Recent orders</h2>
                <ul className="divide-y divide-border text-body-sm">
                  {data.orders.slice(0, 5).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={orderHref} className="font-mono text-accent-text hover:underline">
                        {o.number}
                      </Link>
                      <span className="flex-1 truncate text-fg-muted">{o.items.join(", ")}</span>
                      <span className="font-mono tnum">{money(o.total)}</span>
                      <StatusBadge kind="orders.status" value={o.status} size="sm" />
                    </li>
                  ))}
                  {data.orders.length === 0 ? (
                    <li className="py-2 text-fg-muted">No orders yet</li>
                  ) : null}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <h2 className="mb-2 text-h4">Active entitlements</h2>
                <ul className="divide-y divide-border text-body-sm">
                  {data.entitlements
                    .filter((e) => e.status === "active")
                    .slice(0, 5)
                    .map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                        <span>
                          {e.product} · <span className="text-fg-muted">{e.offering}</span>
                        </span>
                        <StatusBadge kind="entitlements.delivery_type" value={e.type} size="sm" />
                      </li>
                    ))}
                </ul>
              </div>
            </TabsContent>
            <TabsContent value="orders">
              <div className="rounded-lg border border-border bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <Link
                            href={orderHref}
                            className="font-mono text-accent-text hover:underline"
                          >
                            {o.number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-fg-muted">{formatDate(o.placedAt)}</TableCell>
                        <TableCell>{o.items.join(", ")}</TableCell>
                        <TableCell>
                          <MoneyCell value={o.total} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="payments.status" value={o.payment.status} size="sm" />
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="orders.status" value={o.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="entitlements">
              <div className="rounded-lg border border-border bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product · offering</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead>Downloads</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.entitlements.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          {e.product} <span className="text-fg-muted">· {e.offering}</span>
                          {e.grantedManually ? (
                            <Badge tone="accent" size="sm" className="ml-2">
                              manual grant
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="entitlements.delivery_type" value={e.type} size="sm" />
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="entitlements.status" value={e.status} size="sm" />
                        </TableCell>
                        <TableCell className="text-fg-muted">
                          {e.accessEnds ?? "Lifetime"}
                        </TableCell>
                        <TableCell className="font-mono tnum">
                          {e.downloadCap ? `${e.downloadsUsed ?? 0}/${e.downloadCap}` : "—"}
                        </TableCell>
                        <TableCell>
                          <RowActions
                            label={`Actions for ${e.product}`}
                            actions={[
                              { label: "Open order", href: orderHref },
                              { label: "Revoke", destructive: true },
                              { label: "Reset downloads", disabled: !e.downloadCap },
                              { label: "Extend" },
                              { label: "Cancel subscription", disabled: !e.subscription },
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="queries">
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {data.queries.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-body-sm"
                  >
                    <Link href={queriesHref} className="font-medium hover:text-accent-text">
                      {q.subject}
                    </Link>
                    <StatusBadge kind="queries.status" value={q.status} size="sm" />
                  </li>
                ))}
                {data.queries.length === 0 ? (
                  <li className="px-4 py-3 text-body-sm text-fg-muted">No queries</li>
                ) : null}
              </ul>
            </TabsContent>
            <TabsContent value="activity" className="space-y-4">
              <Gauge
                value={data.chatUsage.today}
                max={data.chatUsage.cap}
                label="Chatbot messages today"
              />
              <ol className="space-y-2 rounded-lg border border-border bg-surface p-4 text-body-sm">
                {data.activity.map((a) => (
                  <li key={a.at} className="flex justify-between gap-3">
                    <span>{a.text}</span>
                    <time dateTime={a.at} className="shrink-0 text-caption text-fg-muted">
                      {formatDateTime(a.at)}
                    </time>
                  </li>
                ))}
              </ol>
              <Button asChild variant="link" size="sm">
                <Link href={auditHref}>Full audit trail</Link>
              </Button>
            </TabsContent>
          </Tabs>
        </div>
        <aside className="space-y-4 lg:col-span-4">
          <section
            aria-label="Internal notes"
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-h4">Internal notes</h2>
              <span className="text-caption text-fg-muted" aria-live="polite">
                {notesSaved}
              </span>
            </div>
            <Label htmlFor="cust-notes" className="sr-only">
              Internal notes
            </Label>
            <Textarea
              id="cust-notes"
              defaultValue={data.notes}
              rows={5}
              onChange={() => setNotesSaved("Saving…")}
              onBlur={() => setNotesSaved("Saved")}
              disabled={deleted}
            />
            <ul className="mt-2 text-caption text-fg-muted">
              {data.notesHistory.map((h) => (
                <li key={h.at}>
                  Edited by {h.by} · {formatDateTime(h.at)}
                </li>
              ))}
            </ul>
          </section>
          <section
            aria-label="Billing details"
            className="rounded-lg border border-border bg-surface p-4"
          >
            <h2 className="mb-2 text-h4">Billing details</h2>
            <KeyValue
              columns={1}
              items={[
                { label: "Bill to", value: data.billing.name },
                { label: "Address", value: data.billing.address },
                { label: "GSTIN", value: data.billing.gstin ?? "—", mono: true },
                { label: "Last used at checkout", value: formatDateTime(data.billing.lastUsedAt) },
              ]}
            />
          </section>
          <section
            aria-label="Preferences"
            className="rounded-lg border border-border bg-surface p-4"
          >
            <h2 className="mb-2 text-h4">Preferences</h2>
            <KeyValue
              columns={1}
              items={[
                { label: "Display currency", value: data.preferences.currency },
                { label: "Theme", value: data.preferences.theme },
                { label: "Email preferences", value: data.preferences.emailPrefs },
              ]}
            />
          </section>
        </aside>
      </div>

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Grant access to {c.name}</DialogTitle>
            <DialogDescription>
              Manual grants create an entitlement without an order or invoice; use a manual order if
              money changed hands. No ledger entries or allocations; audited; the other admins are
              notified.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="grant-offering" label="Offering" required className="sm:col-span-2">
              <Select defaultValue={data.offeringOptions[0]?.id}>
                <SelectTrigger id="grant-offering">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.offeringOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="grant-access" label="Access" required>
              <Select defaultValue="lifetime">
                <SelectTrigger id="grant-access">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                  <SelectItem value="12">12 months</SelectItem>
                  <SelectItem value="3">3 months</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id="grant-order" label="Link to existing order" optional>
              <Input id="grant-order" placeholder="CK-ORD-…" className="font-mono" />
            </Field>
            <Field
              id="grant-reason"
              label="Reason"
              required
              className="sm:col-span-2"
              error={
                reason.trim() === ""
                  ? "A reason is mandatory and is written to the audit log."
                  : undefined
              }
            >
              <Textarea
                id="grant-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-invalid={reason.trim() === ""}
                required
                aria-required
              />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              disabled={reason.trim() === ""}
              onClick={() => {
                toast.success("Access granted — customer emailed");
                setGrantOpen(false);
              }}
            >
              Grant access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
