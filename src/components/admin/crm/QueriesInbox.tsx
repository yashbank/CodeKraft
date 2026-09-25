"use client";

import Link from "next/link";
import * as React from "react";
import { BotIcon, ChevronDownIcon, PaperclipIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";
import { Banner } from "../Banner";
import { formatDateTime, initials, money, timeAgo } from "../format";
import { Field } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { AdminUserRef, CustomerOption, QueryMessage, QueryRow, QueryThread } from "../types";

export interface QueriesInboxProps {
  queries: QueryRow[];
  thread: QueryThread;
  admins: AdminUserRef[];
  customers: CustomerOption[];
  now: string;
  approvalsHref: string;
  leadsHref: string;
  customerHref: string;
  chatbotHref: string;
}

/**
 * SCR-ADM-15 — two-pane support inbox: status tabs, filters, list rows with unread dots, and the
 * thread (`role="log"`) with system cards for refund requests, internal notes, canned replies
 * and the composer. "Log a query" records email/manual requests.
 */
export function QueriesInbox({
  queries,
  thread,
  admins,
  customers,
  now,
  approvalsHref,
  leadsHref,
  customerHref,
  chatbotHref,
}: QueriesInboxProps) {
  const [status, setStatus] = React.useState<QueryRow["status"]>("open");
  const [selectedId, setSelectedId] = React.useState(thread.query.id);
  const [messages, setMessages] = React.useState<QueryMessage[]>(thread.messages);
  const [draft, setDraft] = React.useState("");
  const [internal, setInternal] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState(false);
  const [contextOpen, setContextOpen] = React.useState(false);
  const list = queries.filter((q) => q.status === status);
  const selected = queries.find((q) => q.id === selectedId) ?? thread.query;
  const isThread = selected.id === thread.query.id;

  const send = (resolve: boolean) => {
    if (!draft.trim()) return;
    setMessages((m) => [
      ...m,
      {
        id: `m-${Date.now()}`,
        authorKind: "admin",
        author: "You",
        at: now,
        text: draft.trim(),
        internal,
      },
    ]);
    setDraft("");
    toast.success(
      internal
        ? "Internal note saved"
        : resolve
          ? "Reply sent and resolved — customer emailed"
          : "Reply sent — customer emailed",
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr] xl:grid-cols-[380px_1fr]">
      <section
        aria-label="Query list"
        className="flex min-h-0 flex-col rounded-lg border border-border bg-surface"
      >
        <div className="space-y-3 border-b border-border p-3">
          <div className="flex items-center justify-between">
            <h1 className="text-h3">Queries</h1>
            <Button size="sm" variant="secondary" onClick={() => setLogOpen(true)}>
              <PlusIcon aria-hidden /> Log a query
            </Button>
          </div>
          <Tabs value={status} onValueChange={(v) => setStatus(v as QueryRow["status"])}>
            <TabsList className="w-full">
              <TabsTrigger value="open">
                Open ({queries.filter((q) => q.status === "open").length})
              </TabsTrigger>
              <TabsTrigger value="waiting_customer">Waiting</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="q-source" className="sr-only">
                Source
              </Label>
              <Select>
                <SelectTrigger id="q-source" size="sm">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  {["form", "chatbot", "order", "dashboard", "email", "manual"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="q-assigned" className="sr-only">
                Assigned
              </Label>
              <Select>
                <SelectTrigger id="q-assigned" size="sm">
                  <SelectValue placeholder="Assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Me</SelectItem>
                  <SelectItem value="pool">Pool</SelectItem>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="q-search" className="sr-only">
              Search queries
            </Label>
            <Input id="q-search" type="search" placeholder="Search…" className="h-8" />
          </div>
        </div>
        <ul className="divide-y divide-border overflow-y-auto" aria-label="Queries">
          {list.length === 0 ? (
            <li className="p-6 text-center text-body-sm text-fg-muted">
              {status === "open" ? "Inbox zero — no open queries" : "Nothing here"}
            </li>
          ) : null}
          {list.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => setSelectedId(q.id)}
                aria-current={selected.id === q.id ? "true" : undefined}
                className={cn(
                  "flex w-full items-start gap-3 p-3 text-left hover:bg-accent-soft/50",
                  selected.id === q.id && "bg-accent-soft/60",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-2 size-2 shrink-0 rounded-full",
                    q.unread ? "bg-accent" : "bg-transparent",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-body-sm", q.unread && "font-semibold")}>
                    {q.unread ? <span className="sr-only">Unread: </span> : null}
                    {q.subject}
                  </span>
                  <span className="block truncate text-caption text-fg-muted">
                    {q.customer
                      ? `${q.customer.name} · ${q.customer.email}`
                      : `Visitor · ${q.visitorEmail}`}
                  </span>
                  <span className="block truncate text-caption text-fg-subtle">{q.snippet}</span>
                  <span className="mt-1 flex items-center gap-2 text-caption text-fg-muted">
                    <StatusBadge kind="queries.source" value={q.source} size="sm" hideIcon />
                    {timeAgo(q.updatedAt, now)}
                  </span>
                </span>
                {q.assignee ? (
                  <Avatar size="sm">
                    <AvatarFallback>{initials(q.assignee.name)}</AvatarFallback>
                  </Avatar>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Thread"
        className="flex min-h-0 flex-col rounded-lg border border-border bg-surface"
      >
        <header className="space-y-2 border-b border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-h3">{selected.subject}</h2>
            <StatusBadge kind="queries.status" value={selected.status} />
            <StatusBadge kind="queries.source" value={selected.source} size="sm" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-body-sm">
            {selected.related.map((r) => (
              <Link
                key={`${r.kind}-${r.label}`}
                href={
                  r.href ??
                  (r.kind === "lead"
                    ? leadsHref
                    : r.kind === "conversation"
                      ? chatbotHref
                      : customerHref)
                }
              >
                <Badge tone={r.kind === "order" ? "accent" : "neutral"} size="sm">
                  {r.kind === "order" ? "Order " : ""}
                  {r.label}
                </Badge>
              </Link>
            ))}
            {!selected.customer ? (
              <span className="text-caption text-fg-muted">
                Replies go to {selected.visitorEmail} only
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="thread-assignee" className="sr-only">
              Assignee
            </Label>
            <Select defaultValue={selected.assignee?.id ?? "pool"} key={selected.id}>
              <SelectTrigger id="thread-assignee" size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pool">Unassigned (claim)</SelectItem>
                {admins.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="secondary" onClick={() => toast.success("Resolved")}>
              Resolve
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.success("Closed")}>
              Close
            </Button>
            <Button size="sm" variant="ghost" disabled={selected.status === "open"}>
              Reopen
            </Button>
            <RowActions
              label="More thread actions"
              actions={[
                {
                  label: "Propose refund",
                  disabled: !selected.related.some((r) => r.kind === "order"),
                },
                { label: "Create lead", href: leadsHref },
                { label: "View customer", href: customerHref, disabled: !selected.customer },
              ]}
            />
          </div>
        </header>
        <div
          role="log"
          aria-live="polite"
          aria-label="Messages"
          className="flex-1 space-y-3 overflow-y-auto p-4"
        >
          {selected.refundRequest ? (
            <Banner tone="warning" title="Refund request">
              Order {selected.refundRequest.order} · {selected.refundRequest.method} ·{" "}
              {money(selected.refundRequest.amount)} · product{" "}
              {selected.refundRequest.refundable ? "is refundable" : "is not refundable"}
              <div className="mt-2">
                <Button asChild size="sm" variant="secondary">
                  <Link href={approvalsHref}>Propose refund</Link>
                </Button>
              </div>
            </Banner>
          ) : null}
          {selected.source === "chatbot" ? (
            <div className="rounded-md border border-border bg-canvas">
              <button
                type="button"
                aria-expanded={contextOpen}
                onClick={() => setContextOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-body-sm font-medium"
              >
                <BotIcon aria-hidden className="size-4" /> Chatbot context{" "}
                <ChevronDownIcon
                  aria-hidden
                  className={cn("ml-auto size-4 transition-transform", contextOpen && "rotate-180")}
                />
              </button>
              {contextOpen ? (
                <ul className="space-y-1 border-t border-border px-3 py-2 text-body-sm text-fg-muted">
                  {(
                    thread.chatbotContext ?? [
                      "User: Can I pay from a company account?",
                      "Assistant: Yes — add your GSTIN at checkout…",
                      "User: Talk to a human",
                    ]
                  ).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {(isThread
            ? messages
            : [
                {
                  id: "x",
                  authorKind: "customer" as const,
                  author: selected.customer?.name ?? "Visitor",
                  at: selected.updatedAt,
                  text: selected.snippet,
                },
              ]
          ).map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.authorKind === "admin"
                  ? "justify-end"
                  : m.authorKind === "system"
                    ? "justify-center"
                    : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[78%] rounded-lg px-3 py-2 text-body-sm",
                  m.authorKind === "customer" && "bg-accent-soft text-fg",
                  m.authorKind === "admin" && !m.internal && "bg-info-soft text-fg",
                  m.authorKind === "admin" &&
                    m.internal &&
                    "border border-dashed border-warning bg-warning-soft text-fg",
                  m.authorKind === "system" && "bg-elevated text-caption text-fg-muted",
                )}
              >
                {m.internal ? (
                  <p className="mb-1 text-caption font-semibold text-warning">
                    Internal note — never emailed
                  </p>
                ) : null}
                <p>{m.text}</p>
                {m.attachments?.map((a) => (
                  <p
                    key={a}
                    className="mt-1 inline-flex items-center gap-1 text-caption text-accent-text"
                  >
                    <PaperclipIcon aria-hidden className="size-3" />
                    {a}
                  </p>
                ))}
                <p className="mt-1 text-caption text-fg-muted">
                  {m.author} · <time dateTime={m.at}>{formatDateTime(m.at)}</time>
                </p>
              </div>
            </div>
          ))}
        </div>
        <footer className="space-y-2 border-t border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm">
                  Canned replies
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 space-y-1">
                {thread.snippets.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDraft(s)}
                    className="block w-full rounded-sm px-2 py-1.5 text-left text-body-sm hover:bg-accent-soft"
                  >
                    {s}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-2">
              <Switch id="q-internal" size="sm" checked={internal} onCheckedChange={setInternal} />
              <Label htmlFor="q-internal">Internal note</Label>
            </div>
          </div>
          <Label htmlFor="q-composer" className="sr-only">
            Reply
          </Label>
          <Textarea
            id="q-composer"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              internal ? "Visible to admins only" : "Reply to the customer (bold, lists, links)…"
            }
            className={cn(internal && "border-warning")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm">
              <PaperclipIcon aria-hidden /> Attach (3 × 10 MB)
            </Button>
            <span className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => send(true)}
                disabled={!draft.trim() || internal}
              >
                Reply & resolve
              </Button>
              <Button size="sm" onClick={() => send(false)} disabled={!draft.trim()}>
                {internal ? "Save note" : "Reply"}
              </Button>
            </span>
          </div>
        </footer>
      </section>

      <Sheet open={logOpen} onOpenChange={setLogOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Log a query</SheetTitle>
            <SheetDescription>
              For requests that arrived by email (invoice contact) or were taken manually.
            </SheetDescription>
          </SheetHeader>
          <form className="space-y-4 px-4" onSubmit={(e) => e.preventDefault()}>
            <Field id="lq-customer" label="Customer" hint="Or a guest email below.">
              <Select>
                <SelectTrigger id="lq-customer">
                  <SelectValue placeholder="Search customers" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="lq-email" label="Guest email" optional>
              <Input id="lq-email" type="email" />
            </Field>
            <Field id="lq-subject" label="Subject" required>
              <Input id="lq-subject" required aria-required />
            </Field>
            <Field id="lq-message" label="Message" required>
              <Textarea id="lq-message" rows={4} />
            </Field>
            <Field id="lq-source" label="Source" required>
              <Select defaultValue="email">
                <SelectTrigger id="lq-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id="lq-order" label="Related order" optional>
              <Input id="lq-order" placeholder="CK-ORD-…" className="font-mono" />
            </Field>
            <div className="flex items-center gap-2">
              <Switch id="lq-refund" />
              <Label htmlFor="lq-refund">This is a refund request</Label>
            </div>
          </form>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setLogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success("Query logged");
                setLogOpen(false);
              }}
            >
              Log query
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
