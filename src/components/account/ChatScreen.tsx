"use client";

import { BotIcon, HistoryIcon, ListIcon, PlusIcon, SendIcon, SquareIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";
import { Banner } from "./Banner";
import { formatDate } from "./format";
import type { ChatCard, ChatMessage, ChatTranscript } from "./types";

function DataCard({ card }: { card: ChatCard }) {
  switch (card.kind) {
    case "order":
      return (
        <div className="space-y-2 rounded-lg border border-border bg-canvas p-3 text-body-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono text-fg">{card.orderNumber}</span>
            <StatusBadge kind="orders.status" value={card.status} size="sm" />
          </div>
          <ol className="flex flex-wrap gap-x-3 gap-y-1 text-caption">
            {card.steps.map((s) => (
              <li
                key={s.label}
                className={cn("flex items-center gap-1", s.done ? "text-success" : "text-fg-muted")}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    s.done ? "bg-success" : "bg-border-strong",
                  )}
                />
                {s.label}
                <span className="sr-only">{s.done ? " done" : " pending"}</span>
              </li>
            ))}
          </ol>
          <Button size="sm" variant="secondary" asChild>
            <Link href={card.href}>Open order</Link>
          </Button>
        </div>
      );
    case "downloads":
      return (
        <div className="space-y-2 rounded-lg border border-border bg-canvas p-3 text-body-sm">
          <p className="font-semibold text-fg">{card.productName}</p>
          <ul className="flex flex-wrap gap-2">
            {card.files.map((f) => (
              <li key={f.name}>
                <Button size="sm" variant="secondary">
                  {f.name} <span className="text-fg-subtle">v{f.version}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      );
    default:
      return (
        <div className="space-y-2 rounded-lg border border-success bg-success-soft/40 p-3 text-body-sm">
          <p className="font-semibold text-fg">Handed to the team</p>
          <p className="text-fg-muted">Summary: {card.summary}</p>
          {card.queryHref ? (
            <Button size="sm" variant="secondary" asChild>
              <Link href={card.queryHref}>Open the query</Link>
            </Button>
          ) : null}
        </div>
      );
  }
}

/**
 * SCR-ACC-06 — assistant chat: header with usage chip, "New conversation" and "History" sheet;
 * `role="log"` message list with menu chips, data cards, citations; composer with Stop while
 * streaming; cap-reached banner; "Talk to a human" escalation confirm; lead-capture card.
 */
export function ChatScreen({
  firstName,
  messages: initial,
  menu,
  transcripts,
  messagesLeft,
  capReached = false,
  streaming = false,
  connectionLost = false,
  links,
}: {
  firstName: string;
  messages: ChatMessage[];
  menu: string[];
  transcripts: ChatTranscript[];
  messagesLeft: number;
  capReached?: boolean;
  streaming?: boolean;
  connectionLost?: boolean;
  links: { queries: string };
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(initial);
  const [draft, setDraft] = React.useState("");
  const [escalate, setEscalate] = React.useState(false);
  const [summary, setSummary] = React.useState("");
  const logRef = React.useRef<HTMLOListElement>(null);

  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages.length, escalate]);

  function push(m: Omit<ChatMessage, "id" | "at">) {
    setMessages((prev) => [
      ...prev,
      { ...m, id: `local-${prev.length}`, at: new Date().toISOString() },
    ]);
  }

  function quickReply(chip: string) {
    push({ role: "user", text: chip });
    if (chip === "Contact" || chip === "Talk to a human") {
      setEscalate(true);
      return;
    }
    push({
      role: "assistant",
      text: `Quick action "${chip}" runs against your account data — no AI credits used.`,
    });
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-[880px] flex-col lg:h-[calc(100dvh-9rem)]">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <BotIcon aria-hidden className="size-5 text-accent-text" />
        <h1 className="text-h3 text-fg">Assistant</h1>
        <Badge tone={messagesLeft === 0 ? "danger" : messagesLeft <= 3 ? "warning" : "neutral"}>
          {messagesLeft} messages left today
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setMessages([
                {
                  id: "open",
                  role: "assistant",
                  text: `Hi ${firstName}. I can check your orders, downloads and renewals, or answer questions about our products and services. What do you need?`,
                  at: new Date().toISOString(),
                },
                { id: "open-menu", role: "menu", chips: menu, at: new Date().toISOString() },
              ])
            }
          >
            <PlusIcon aria-hidden /> New conversation
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <HistoryIcon aria-hidden /> History
              </Button>
            </SheetTrigger>
            <SheetContent className="z-(--ck-z-modal)">
              <SheetHeader>
                <SheetTitle>Past conversations</SheetTitle>
                <SheetDescription>Transcripts are kept with your account.</SheetDescription>
              </SheetHeader>
              {transcripts.length === 0 ? (
                <p className="px-4 text-body-sm text-fg-muted">No previous conversations</p>
              ) : (
                <ul className="divide-y divide-border px-4">
                  {transcripts.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-3 text-body-sm">
                      <span className="w-24 shrink-0 text-caption text-fg-muted">
                        {formatDate(t.startedAt)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-fg">{t.preview}</span>
                      {t.escalated ? (
                        <Badge tone="info" size="sm">
                          Escalated
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {capReached ? (
        <Banner tone="warning" className="mt-3">
          You&apos;ve reached today&apos;s message limit. Quick actions still work, or talk to a
          human.
        </Banner>
      ) : null}

      <ol
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="flex-1 space-y-4 overflow-y-auto py-4"
      >
        {messages.map((m) => {
          if (m.role === "menu") {
            return (
              <li key={m.id} className="flex justify-start">
                <div
                  role="toolbar"
                  aria-label="Quick replies"
                  className="flex max-w-[85%] flex-wrap gap-2"
                >
                  {(m.chips ?? menu).map((c) => (
                    <Button key={c} variant="outline" size="sm" onClick={() => quickReply(c)}>
                      {c}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => quickReply("Talk to a human")}>
                    Talk to a human
                  </Button>
                </div>
              </li>
            );
          }
          const mine = m.role === "user";
          return (
            <li key={m.id} className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
              {!mine ? (
                <span
                  aria-hidden
                  className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text"
                >
                  <BotIcon className="size-4" />
                </span>
              ) : null}
              <div className={cn("max-w-[85%] space-y-2 sm:max-w-[75%]")}>
                <p className="sr-only">{mine ? "You" : "Assistant"}</p>
                {m.text ? (
                  <div
                    className={cn(
                      "rounded-lg px-4 py-3 text-body-sm whitespace-pre-wrap",
                      mine ? "bg-accent text-accent-fg" : "border border-border bg-surface text-fg",
                    )}
                  >
                    {m.text}
                    {m.interrupted ? (
                      <span className="mt-2 block text-caption text-danger">
                        Connection lost —{" "}
                        <button type="button" className="underline">
                          Retry
                        </button>
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {m.card ? <DataCard card={m.card} /> : null}
                {m.citations?.length ? (
                  <p className="flex flex-wrap gap-x-2 text-caption text-fg-muted">
                    From:{" "}
                    {m.citations.map((c) => (
                      <Link key={c.href} href={c.href} className="text-accent-text hover:underline">
                        {c.label}
                      </Link>
                    ))}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
        {connectionLost ? (
          <li className="flex justify-start">
            <div className="rounded-lg border border-border bg-surface px-4 py-3 text-body-sm text-fg">
              Refunds for FitDesk Pro are handled within 14 days provided…
              <span className="mt-2 block text-caption text-danger">
                Connection lost —{" "}
                <button type="button" className="underline">
                  Retry
                </button>
              </span>
            </div>
          </li>
        ) : null}
        {streaming ? (
          <li
            className="flex items-center gap-2 text-caption text-fg-muted"
            aria-label="Assistant is typing"
          >
            <span aria-hidden className="flex gap-1">
              <span className="size-1.5 animate-pulse rounded-full bg-fg-subtle" />
              <span className="size-1.5 animate-pulse rounded-full bg-fg-subtle [animation-delay:150ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-fg-subtle [animation-delay:300ms]" />
            </span>
            Thinking…
          </li>
        ) : null}
        {escalate ? (
          <li className="flex justify-start">
            <form
              className="max-w-[85%] space-y-3 rounded-lg border border-border bg-surface p-4 text-body-sm"
              onSubmit={(e) => {
                e.preventDefault();
                setEscalate(false);
                push({
                  role: "assistant",
                  card: {
                    kind: "lead_capture",
                    summary: summary || "Conversation handed over",
                    queryHref: links.queries,
                  },
                });
                toast.success("Query created");
              }}
            >
              <p className="text-fg">
                I&apos;ll hand this to the team as a query. Add a short summary?
              </p>
              <Label htmlFor="esc-summary" className="sr-only">
                Summary
              </Label>
              <Textarea
                id="esc-summary"
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="What should we look at?"
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Create query
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEscalate(false)}>
                  Not now
                </Button>
              </div>
            </form>
          </li>
        ) : null}
      </ol>

      <form
        className="space-y-2 border-t border-border pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          push({ role: "user", text: draft.trim() });
          setDraft("");
        }}
      >
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => push({ role: "menu", chips: menu })}
            aria-label="Show menu"
          >
            <ListIcon aria-hidden /> Menu
          </Button>
          <div className="flex-1">
            <Label htmlFor="chat-input" className="sr-only">
              Message
            </Label>
            <Textarea
              id="chat-input"
              rows={1}
              maxLength={2000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={capReached || streaming}
              placeholder={
                capReached ? "Daily limit reached" : "Ask about your orders or our products"
              }
              className="min-h-10 resize-none"
            />
          </div>
          {streaming ? (
            <Button type="button" variant="secondary" size="icon-md" aria-label="Stop generating">
              <SquareIcon aria-hidden />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon-md"
              aria-label="Send"
              disabled={capReached || !draft.trim()}
            >
              <SendIcon aria-hidden />
            </Button>
          )}
        </div>
        <p className="text-caption text-fg-subtle">
          Answers are based on CodeKraft&apos;s site content.
        </p>
      </form>
    </div>
  );
}
