"use client";

import Link from "next/link";
import * as React from "react";
import { ChevronDownIcon, DownloadIcon, LockIcon, ScrollTextIcon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/components/ui/_utils";
import { DataToolbar, ToolbarField } from "../DataToolbar";
import { EmptyState } from "../EmptyState";
import { formatDateTime, initials } from "../format";
import { PageHeader } from "../PageHeader";
import type { AuditRow } from "../types";

const ACTION_GROUPS = [
  "auth.*",
  "catalog.*",
  "orders.*",
  "payments.*",
  "finance.*",
  "approvals.*",
  "settings.*",
  "users.*",
  "content.*",
  "chat.*",
];

/** SCR-ADM-30 — append-only audit log: dense filterable table with sticky Time/Actor, row expand and a before/after drawer with +/− markers. */
export function AuditLog({
  rows,
  admins,
  approvalsHref,
}: {
  rows: AuditRow[];
  admins: string[];
  approvalsHref: string;
}) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [drawer, setDrawer] = React.useState<AuditRow | null>(null);
  const [live, setLive] = React.useState(false);

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            Audit log <LockIcon aria-hidden className="size-5 text-fg-subtle" />
            <span className="sr-only">append-only</span>
          </span>
        }
        description="Every admin action and auth event with actor, timestamp and before/after (D-1104). Sensitive values are redacted at write time."
        actions={
          <>
            <div className="flex items-center gap-2">
              <Switch id="audit-live" size="sm" checked={live} onCheckedChange={setLive} />
              <Label htmlFor="audit-live">Live tail (10 s)</Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast("Export queued — header line records the filter and generated-by")
              }
            >
              <DownloadIcon aria-hidden /> Export CSV
            </Button>
          </>
        }
      />
      <DataToolbar
        searchId="audit-search"
        searchPlaceholder="Action or memo…"
        filters={
          <>
            <ToolbarField id="audit-from" label="From">
              <Input id="audit-from" type="date" defaultValue="2026-09-18" className="h-8 w-40" />
            </ToolbarField>
            <ToolbarField id="audit-to" label="To">
              <Input id="audit-to" type="date" defaultValue="2026-09-25" className="h-8 w-40" />
            </ToolbarField>
            <ToolbarField id="audit-actor" label="Actor">
              <Select>
                <SelectTrigger id="audit-actor" size="sm" className="w-40">
                  <SelectValue placeholder="Anyone" />
                </SelectTrigger>
                <SelectContent>
                  {admins.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                  <SelectItem value="customer">customer</SelectItem>
                  <SelectItem value="system">system</SelectItem>
                </SelectContent>
              </Select>
            </ToolbarField>
            <ToolbarField id="audit-action" label="Action">
              <Select>
                <SelectTrigger id="audit-action" size="sm" className="w-36">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ToolbarField>
            <ToolbarField id="audit-subject" label="Subject type">
              <Select>
                <SelectTrigger id="audit-subject" size="sm" className="w-36">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "product",
                    "order",
                    "user",
                    "site_settings",
                    "payout",
                    "approval_request",
                    "partner",
                  ].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ToolbarField>
            <ToolbarField id="audit-subject-id" label="Subject id">
              <Input id="audit-subject-id" className="h-8 w-32 font-mono" />
            </ToolbarField>
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={ScrollTextIcon} title="No events match" />
      ) : (
        <div className="rounded-lg border border-border bg-surface">
          <Table>
            <TableCaption className="sr-only">Audit events</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <span className="sr-only">Expand</span>
                </TableHead>
                <TableHead className="sticky left-8 z-(--ck-z-raised) bg-surface">Time</TableHead>
                <TableHead className="sticky left-44 z-(--ck-z-raised) bg-surface">Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Request id</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const open = expanded === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <TableRow className="h-10">
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-expanded={open}
                          aria-controls={`audit-${r.id}`}
                          aria-label={`${open ? "Collapse" : "Expand"} event ${r.action}`}
                          onClick={() => setExpanded(open ? null : r.id)}
                        >
                          <ChevronDownIcon
                            aria-hidden
                            className={cn("size-4 transition-transform", open && "rotate-180")}
                          />
                        </Button>
                      </TableCell>
                      <TableCell className="sticky left-8 z-(--ck-z-raised) bg-surface text-fg-muted">
                        <time dateTime={r.at}>{formatDateTime(r.at)}</time>
                      </TableCell>
                      <TableCell className="sticky left-44 z-(--ck-z-raised) bg-surface">
                        <span className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback>{initials(r.actor.name)}</AvatarFallback>
                          </Avatar>
                          <span>{r.actor.name}</span>
                          <Badge
                            tone={
                              r.actor.kind === "admin"
                                ? "accent"
                                : r.actor.kind === "system"
                                  ? "ghost"
                                  : "neutral"
                            }
                            size="sm"
                          >
                            {r.actor.kind === "admin"
                              ? r.actor.role === "super_admin"
                                ? "Super Admin"
                                : "Admin"
                              : r.actor.kind}
                          </Badge>
                        </span>
                      </TableCell>
                      <TableCell>
                        <code
                          className="font-mono text-caption"
                          aria-label={r.action.replace(/[._]/g, " ")}
                        >
                          {r.action}
                        </code>
                      </TableCell>
                      <TableCell>
                        {r.subjectHref ? (
                          <Link href={r.subjectHref} className="text-accent-text hover:underline">
                            {r.subjectType} · <span className="font-mono">{r.subjectId}</span>
                          </Link>
                        ) : (
                          `${r.subjectType} · ${r.subjectId}`
                        )}
                      </TableCell>
                      <TableCell className="max-w-72 truncate text-fg-muted" title={r.summary}>
                        {r.summary}
                      </TableCell>
                      <TableCell className="font-mono text-caption text-fg-muted">{r.ip}</TableCell>
                      <TableCell className="font-mono text-caption text-fg-muted">
                        {r.requestId}
                      </TableCell>
                    </TableRow>
                    {open ? (
                      <TableRow id={`audit-${r.id}`}>
                        <TableCell colSpan={8} className="bg-canvas whitespace-normal">
                          <div className="flex flex-wrap items-start gap-4">
                            <div className="min-w-0 flex-1">
                              <JsonDiff before={r.before} after={r.after} />
                            </div>
                            <dl className="space-y-1 text-caption text-fg-muted">
                              {r.userAgent ? (
                                <div>
                                  <dt className="inline font-medium">User agent: </dt>
                                  <dd className="inline">{r.userAgent}</dd>
                                </div>
                              ) : null}
                              {r.approvalId ? (
                                <div>
                                  <dt className="inline font-medium">Approval: </dt>
                                  <dd className="inline">
                                    <Link
                                      href={approvalsHref}
                                      className="text-accent-text hover:underline"
                                    >
                                      {r.approvalId}
                                    </Link>
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                            <Button size="sm" variant="secondary" onClick={() => setDrawer(r)}>
                              Open before / after
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-body-sm text-fg-muted">
            <span>{rows.length} events · last 7 days</span>
            <span>cursor pagination</span>
          </div>
        </div>
      )}
      <Sheet open={drawer !== null} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="overflow-y-auto lg:w-[640px]">
          <SheetHeader>
            <SheetTitle>Before / after</SheetTitle>
            <SheetDescription>
              {drawer
                ? `${drawer.action} · ${formatDateTime(drawer.at)} · ${drawer.actor.name}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {drawer ? <JsonDiff before={drawer.before} after={drawer.after} stacked /> : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Side-by-side JSON diff with +/− text markers (never colour alone). */
export function JsonDiff({
  before,
  after,
  stacked = false,
}: {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  stacked?: boolean;
}) {
  if (!before && !after)
    return <p className="text-body-sm text-fg-muted">No before/after payload for this event.</p>;
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  const fmt = (v: unknown) =>
    v === undefined ? "—" : v === null ? "null" : typeof v === "string" ? v : JSON.stringify(v);
  return (
    <div className={cn("grid gap-3", !stacked && "sm:grid-cols-2")}>
      {(["before", "after"] as const).map((side) => (
        <div key={side} className="rounded-md border border-border bg-surface">
          <p className="border-b border-border px-3 py-1.5 text-overline tracking-wider text-fg-muted uppercase">
            {side}
          </p>
          <ul className="space-y-0.5 p-3 font-mono text-caption">
            {keys.map((k) => {
              const changed = fmt(before?.[k]) !== fmt(after?.[k]);
              const v = side === "before" ? before?.[k] : after?.[k];
              const marker = changed ? (side === "before" ? "−" : "+") : " ";
              return (
                <li
                  key={k}
                  className={cn(
                    "flex gap-2 rounded-xs px-1",
                    changed && side === "before" && "bg-danger-soft text-danger",
                    changed && side === "after" && "bg-success-soft text-success",
                  )}
                >
                  <span
                    aria-label={changed ? (side === "before" ? "removed" : "added") : "unchanged"}
                    className="w-3 shrink-0"
                  >
                    {marker}
                  </span>
                  <span className="text-fg-muted">{k}:</span>
                  <span className="break-all">{fmt(v)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
