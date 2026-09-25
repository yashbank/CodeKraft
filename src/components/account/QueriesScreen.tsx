"use client";

import { ChevronRightIcon, MessageSquareIcon, PaperclipIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

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
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";
import { EmptyState } from "./EmptyState";
import { formatDate, formatDateTime, relativeTime } from "./format";
import type { ChatTranscript, QueryStatus, QuerySummary } from "./types";

const STATUS_LABEL: Record<QueryStatus, string> = {
  open: "Open",
  waiting_customer: "Waiting on you",
  resolved: "Resolved",
  closed: "Closed",
};

/** "New query" sheet: subject, related-to select, message, up to 3 attachments. */
export function NewQuerySheet({
  related,
  trigger,
}: {
  related: { value: string; label: string }[];
  trigger: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="z-(--ck-z-modal) overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New query</SheetTitle>
          <SheetDescription>
            We usually reply within 1 working day — by email and here.
          </SheetDescription>
        </SheetHeader>
        <form className="space-y-4 px-4 pb-4" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-2">
            <Label htmlFor="nq-subject" required>
              Subject
            </Label>
            <Input id="nq-subject" required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nq-related">Related to</Label>
            <Select defaultValue="none">
              <SelectTrigger id="nq-related" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {related.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nq-message" required>
              Message
            </Label>
            <Textarea id="nq-message" required maxLength={4000} rows={6} />
            <p className="text-caption text-fg-muted">Up to 4000 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nq-files">Attachments (optional)</Label>
            <Input id="nq-files" type="file" multiple accept="image/*,.pdf,.zip" />
            <p className="text-caption text-fg-muted">
              Up to 3 files, 10 MB each — images, PDF or zip.
            </p>
          </div>
          <Button type="submit" className="w-full">
            Send
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** SCR-ACC-05 (list) — queries and chat history with filter and the "New query" sheet. */
export function QueriesScreen({
  queries,
  transcripts,
  now,
  links,
  loading = false,
}: {
  queries: QuerySummary[];
  transcripts: ChatTranscript[];
  now: string;
  links: { query: (id: string) => string; chat: string; transcript: (id: string) => string };
  loading?: boolean;
}) {
  const [filter, setFilter] = React.useState<"all" | "open" | "waiting_customer" | "resolved">(
    "all",
  );
  const rows = queries.filter((q) => filter === "all" || q.status === filter);
  const related = [
    { value: "ord_13", label: "Order CK-ORD-000013" },
    { value: "ent_license", label: "Purchase · Ledgerly Desktop" },
  ];
  const newQuery = (
    <NewQuerySheet
      related={related}
      trigger={
        <Button>
          <PlusIcon aria-hidden /> New query
        </Button>
      }
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 text-fg">Queries</h1>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger size="sm" aria-label="Filter queries" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="waiting_customer">Waiting on you</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          {newQuery}
        </div>
      </div>

      <Tabs defaultValue="queries">
        <TabsList variant="line">
          <TabsTrigger value="queries">Queries</TabsTrigger>
          <TabsTrigger value="chat">Chat history</TabsTrigger>
        </TabsList>
        <TabsContent value="queries" className="mt-4">
          {loading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={MessageSquareIcon}
              title="No queries yet"
              body="Ask the assistant for quick answers, or start a query and we'll reply within a working day."
              action={
                <>
                  <Button variant="secondary" asChild>
                    <Link href={links.chat}>Ask the assistant</Link>
                  </Button>
                  {newQuery}
                </>
              }
            />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {rows.map((q) => (
                <li key={q.id}>
                  <Link
                    href={links.query(q.id)}
                    className="flex items-start gap-3 p-4 hover:bg-accent-soft/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-2 size-2 shrink-0 rounded-full",
                        q.unread ? "bg-accent" : "bg-transparent",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-body text-fg", q.unread && "font-semibold")}>
                          {q.subject}
                        </span>
                        {q.unread ? <span className="sr-only">(unread)</span> : null}
                        <StatusBadge
                          kind="queries.status"
                          value={q.status}
                          size="sm"
                          label={STATUS_LABEL[q.status]}
                        />
                        {q.relatedLabel ? (
                          <Badge tone="neutral" size="sm">
                            {q.relatedLabel}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-body-sm text-fg-muted">
                        {q.preview}
                      </span>
                    </span>
                    <span
                      className="shrink-0 text-caption text-fg-subtle"
                      title={formatDateTime(q.lastActivityAt)}
                    >
                      {relativeTime(q.lastActivityAt, now)}
                    </span>
                    <ChevronRightIcon
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-fg-subtle"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="chat" className="mt-4">
          {transcripts.length === 0 ? (
            <EmptyState icon={MessageSquareIcon} title="No previous conversations" />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {transcripts.map((t) => (
                <li key={t.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                  <span className="w-28 shrink-0 text-caption text-fg-muted">
                    {formatDate(t.startedAt)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body-sm text-fg">{t.preview}</span>
                  {t.escalated ? (
                    <Badge tone="info" size="sm">
                      Escalated
                    </Badge>
                  ) : null}
                  <Button variant="link" size="sm" asChild>
                    <Link href={links.transcript(t.id)}>View transcript</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** SCR-ACC-05 (thread) — message bubbles, related chips, "Mark resolved", composer (disabled when closed). */
export function QueryThreadScreen({
  query: q,
  now,
  links,
  sendError = false,
}: {
  query: QuerySummary;
  now: string;
  links: { queries: string };
  sendError?: boolean;
}) {
  const [draft, setDraft] = React.useState(
    sendError ? "Here's the log file you asked for — attached." : "",
  );
  const closed = q.status === "closed";
  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-body-sm text-fg-muted">
          <li>
            <Link href={links.queries} className="hover:text-fg">
              Queries
            </Link>
          </li>
          <li className="flex min-w-0 items-center gap-1">
            <ChevronRightIcon aria-hidden className="size-3.5" />
            <span aria-current="page" className="truncate font-medium text-fg">
              {q.subject}
            </span>
          </li>
        </ol>
      </nav>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h2 text-fg">{q.subject}</h1>
            <StatusBadge kind="queries.status" value={q.status} label={STATUS_LABEL[q.status]} />
          </div>
          <div className="flex flex-wrap gap-2">
            {q.relatedHref && q.relatedLabel ? (
              <Badge tone="accent">
                <Link href={q.relatedHref} className="hover:underline">
                  {q.relatedLabel}
                </Link>
              </Badge>
            ) : null}
            <StatusBadge kind="queries.source" value={q.source} size="sm" />
          </div>
        </div>
        {q.status === "open" || q.status === "waiting_customer" ? (
          <Button variant="secondary" size="sm">
            Mark resolved
          </Button>
        ) : null}
      </header>

      <ol className="flex-1 space-y-4" aria-label="Conversation">
        {q.messages.map((m) => {
          if (m.author === "system") {
            return (
              <li key={m.id} className="text-center text-caption text-fg-muted">
                {m.body} · <time dateTime={m.at}>{relativeTime(m.at, now)}</time>
              </li>
            );
          }
          const mine = m.author === "customer";
          return (
            <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] space-y-1 sm:max-w-[70%]", mine && "text-right")}>
                <p className="text-caption text-fg-muted">
                  {mine ? "You" : `CodeKraft${m.authorName ? ` · ${m.authorName}` : ""}`} ·{" "}
                  <time dateTime={m.at} title={formatDateTime(m.at)}>
                    {relativeTime(m.at, now)}
                  </time>
                </p>
                <div
                  className={cn(
                    "rounded-lg px-4 py-3 text-left text-body-sm whitespace-pre-wrap",
                    mine ? "bg-accent text-accent-fg" : "border border-border bg-surface text-fg",
                  )}
                >
                  {m.body}
                </div>
                {m.attachments?.length ? (
                  <ul className={cn("flex flex-wrap gap-2", mine && "justify-end")}>
                    {m.attachments.map((a) => (
                      <li key={a.name}>
                        <Button variant="outline" size="sm">
                          <PaperclipIcon aria-hidden /> {a.name}{" "}
                          <span className="text-fg-subtle">· {a.sizeLabel}</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <form
        className="sticky bottom-16 space-y-2 rounded-lg border border-border bg-surface p-3 lg:bottom-0"
        onSubmit={(e) => e.preventDefault()}
      >
        {sendError ? (
          <p role="alert" className="text-caption text-danger">
            Couldn&apos;t send — your message is kept.{" "}
            <button type="button" className="underline">
              Retry
            </button>
          </p>
        ) : null}
        <Label htmlFor="reply" className="sr-only">
          Reply
        </Label>
        <Textarea
          id="reply"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={closed}
          placeholder={closed ? "This query is closed — start a new one" : "Write a reply"}
          maxLength={4000}
        />
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={closed}>
            <PaperclipIcon aria-hidden /> Attach
          </Button>
          <Button type="submit" size="sm" disabled={closed || draft.trim().length === 0}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
