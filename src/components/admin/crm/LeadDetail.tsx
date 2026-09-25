"use client";

import Link from "next/link";
import * as React from "react";
import {
  AlarmClockIcon,
  ArrowRightLeftIcon,
  CheckIcon,
  MailIcon,
  PhoneIcon,
  StickyNoteIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

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
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";
import { Banner } from "../Banner";
import { daysUntil, formatDate, formatDateTime } from "../format";
import { KeyValue } from "../KeyValue";
import { PageHeader } from "../PageHeader";
import { RowActions } from "../RowActions";
import type { LeadActivity, LeadDetailData, LeadStatus } from "../types";

const STAGES: LeadStatus[] = ["new", "contacted", "qualified", "proposal", "won", "lost"];
const STAGE_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};
const ACTIVITY_ICON: Record<LeadActivity["kind"], LucideIcon> = {
  note: StickyNoteIcon,
  status_change: ArrowRightLeftIcon,
  assignment: UserPlusIcon,
  follow_up_set: AlarmClockIcon,
  email: MailIcon,
  call: PhoneIcon,
};

export interface LeadDetailProps {
  data: LeadDetailData;
  now: string;
  newOrderHref: string;
  quotesHref: string;
  chatbotHref: string;
  customerHref: string;
  productHref: string;
}

/** SCR-ADM-14 — lead detail: pipeline stepper, original message, activity timeline with composer, transcript excerpt, contact/follow-up/convert cards. */
export function LeadDetail({
  data,
  now,
  newOrderHref,
  quotesHref,
  chatbotHref,
  customerHref,
  productHref,
}: LeadDetailProps) {
  const { lead } = data;
  const [status, setStatus] = React.useState<LeadStatus>(lead.status);
  const [activities, setActivities] = React.useState(data.activities);
  const [composer, setComposer] = React.useState("");
  const [composerKind, setComposerKind] = React.useState<"note" | "call" | "email">("note");
  const overdueDays = lead.nextFollowUpAt ? -daysUntil(lead.nextFollowUpAt, now) : 0;

  const addActivity = () => {
    if (!composer.trim()) return;
    setActivities((a) => [
      { id: `a-${Date.now()}`, kind: composerKind, actor: "You", at: now, text: composer.trim() },
      ...a,
    ]);
    setComposer("");
    toast.success(
      composerKind === "note"
        ? "Note added"
        : `${composerKind === "call" ? "Call" : "Email"} logged`,
    );
  };

  return (
    <>
      <PageHeader
        title={
          <>
            {lead.name}
            {lead.company ? <span className="text-fg-muted"> · {lead.company}</span> : null}
          </>
        }
        titleAdornment={
          <>
            <StatusBadge kind="leads.source" value={lead.source} />
            {lead.product ? (
              <Link href={productHref}>
                <Badge tone="ghost">{lead.product}</Badge>
              </Link>
            ) : null}
          </>
        }
        actions={
          <>
            <div className="space-y-1">
              <Label htmlFor="lead-priority" className="sr-only">
                Priority
              </Label>
              <Select defaultValue={lead.priority}>
                <SelectTrigger id="lead-priority" size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lead-assignee" className="sr-only">
                Assignee
              </Label>
              <Select defaultValue={lead.assignee?.id ?? "pool"}>
                <SelectTrigger id="lead-assignee" size="sm" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pool">Unassigned (claim)</SelectItem>
                  {data.admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <AlarmClockIcon aria-hidden />{" "}
                  {lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : "Set follow-up"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fu-date">Follow-up date</Label>
                  <Input
                    id="fu-date"
                    type="date"
                    defaultValue={lead.nextFollowUpAt?.slice(0, 10)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fu-note">Note</Label>
                  <Textarea
                    id="fu-note"
                    rows={2}
                    placeholder="What will you do next?"
                    defaultValue={data.followUpNote}
                  />
                </div>
                <Button size="sm" onClick={() => toast.success("Follow-up set")}>
                  Save
                </Button>
              </PopoverContent>
            </Popover>
            <RowActions
              label="More lead actions"
              actions={[
                { label: "Mark lost", onSelect: () => setStatus("lost") },
                { label: "Merge duplicate" },
                {
                  label: "Delete",
                  destructive: true,
                  disabled: activities.length > 0,
                  separatorBefore: true,
                },
              ]}
            />
          </>
        }
      />
      {overdueDays > 0 && status !== "won" && status !== "lost" ? (
        <Banner tone="danger" role="status" icon={AlarmClockIcon} className="mb-4">
          Follow-up was due {overdueDays} day{overdueDays === 1 ? "" : "s"} ago.
        </Banner>
      ) : null}
      <ol role="radiogroup" aria-label="Pipeline stage" className="mb-6 flex flex-wrap gap-2">
        {STAGES.map((s, i) => {
          const idx = STAGES.indexOf(status);
          const done = i < idx && status !== "lost";
          const current = s === status;
          return (
            <li key={s}>
              <button
                type="button"
                role="radio"
                aria-checked={current}
                onClick={() => {
                  setStatus(s);
                  toast.success(`Status → ${STAGE_LABEL[s]}`);
                }}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-body-sm font-medium",
                  current
                    ? "border-accent bg-accent text-accent-fg"
                    : done
                      ? "border-success bg-success-soft text-success"
                      : "border-border bg-surface text-fg-muted hover:text-fg",
                )}
              >
                {done ? <CheckIcon aria-hidden className="size-3.5" /> : null}
                {STAGE_LABEL[s]}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <section
            aria-label="Original message"
            className="rounded-lg border border-border bg-surface p-5"
          >
            <h2 className="mb-3 text-h4">Original message</h2>
            <KeyValue
              columns={3}
              items={[
                {
                  label: "Service interest",
                  value: (
                    <span className="flex flex-wrap gap-1">
                      {lead.services.map((s) => (
                        <Badge key={s} tone="neutral" size="sm">
                          {s}
                        </Badge>
                      ))}
                      {lead.services.length === 0 ? "—" : null}
                    </span>
                  ),
                },
                { label: "Budget hint", value: data.budgetHint ?? "—" },
                { label: "Product", value: lead.product ?? "—" },
                { label: "Submitted", value: formatDateTime(data.submittedAt) },
                {
                  label: "Turnstile",
                  value: data.turnstileVerified ? "Verified ✔" : "Not verified",
                },
                { label: "IP country", value: data.ipCountry },
              ]}
            />
            <p className="mt-4 rounded-md bg-canvas p-3 text-body">{data.message}</p>
          </section>

          <section aria-label="Activity" className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-3 text-h4">Activity</h2>
            <Tabs
              value={composerKind}
              onValueChange={(v) => setComposerKind(v as typeof composerKind)}
            >
              <TabsList>
                <TabsTrigger value="note">Note</TabsTrigger>
                <TabsTrigger value="call">Call</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
              </TabsList>
              {(["note", "call", "email"] as const).map((k) => (
                <TabsContent key={k} value={k} className="space-y-2">
                  <Label htmlFor={`composer-${k}`} className="sr-only">
                    {k === "note" ? "Add a note" : `Log a ${k}`}
                  </Label>
                  <Textarea
                    id={`composer-${k}`}
                    rows={3}
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    placeholder={
                      k === "note"
                        ? "Add a note…"
                        : k === "call"
                          ? "Call summary (logged manually, nothing is dialled)"
                          : "Email summary (logged manually, nothing is sent)"
                    }
                  />
                  <Button size="sm" onClick={addActivity} disabled={!composer.trim()}>
                    {k === "note" ? "Add note" : `Log ${k}`}
                  </Button>
                </TabsContent>
              ))}
            </Tabs>
            <ol className="mt-5 space-y-4" aria-live="polite">
              {activities.length === 0 ? (
                <li className="text-body-sm text-fg-muted">No activity yet — add a note.</li>
              ) : null}
              {activities.map((a) => {
                const Icon = ACTIVITY_ICON[a.kind];
                return (
                  <li key={a.id} className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-elevated text-fg-muted"
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm">{a.text}</p>
                      <p className="text-caption text-fg-muted">
                        {a.actor} · <time dateTime={a.at}>{formatDateTime(a.at)}</time>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {data.transcript ? (
            <section
              aria-label="Chat transcript"
              className="rounded-lg border border-border bg-surface p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-h4">Chat transcript</h2>
                <Button asChild variant="link" size="sm">
                  <Link href={chatbotHref}>Full transcript</Link>
                </Button>
              </div>
              <ol className="space-y-2">
                {data.transcript.map((t, i) => (
                  <li
                    key={i}
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-body-sm",
                      t.role === "user" ? "ml-auto bg-accent text-accent-fg" : "bg-canvas",
                    )}
                  >
                    <span className="sr-only">{t.role === "user" ? "User: " : "Assistant: "}</span>
                    {t.text}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:col-span-4">
          <section aria-label="Contact" className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-2 text-h4">Contact</h2>
            <KeyValue
              columns={1}
              items={[
                { label: "Email", value: lead.email, mono: true },
                { label: "Phone", value: lead.phone ?? "—" },
                { label: "Company", value: lead.company ?? "—" },
                {
                  label: "Customer account",
                  value: data.linkedCustomerId ? (
                    <Link href={customerHref} className="text-accent-text hover:underline">
                      Open customer
                    </Link>
                  ) : (
                    "Not a customer"
                  ),
                },
              ]}
            />
          </section>
          <section
            aria-label="Follow-up"
            className="rounded-lg border border-border bg-surface p-4"
          >
            <h2 className="mb-2 text-h4">Follow-up</h2>
            <p className="text-body-sm">
              {lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : "None set"}
              {overdueDays > 0 ? (
                <span className="text-danger"> · overdue by {overdueDays} d</span>
              ) : null}
            </p>
            {data.followUpNote ? (
              <p className="text-caption text-fg-muted">{data.followUpNote}</p>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => toast("Done — set the next follow-up")}
            >
              Done → set next
            </Button>
          </section>
          <section
            aria-label="Convert"
            className="space-y-2 rounded-lg border border-border bg-surface p-4"
          >
            <h2 className="text-h4">Convert</h2>
            <Button asChild className="w-full">
              <Link href={newOrderHref}>Create project order</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="w-full"
              disabled={!data.linkedCustomerId}
            >
              <Link href={quotesHref}>Send custom quote</Link>
            </Button>
            {!data.linkedCustomerId ? (
              <p className="text-caption text-fg-muted">Quotes require a customer account.</p>
            ) : null}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setStatus("won")}
              >
                Mark Won
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setStatus("lost")}
              >
                Mark Lost
              </Button>
            </div>
          </section>
          {data.related.length > 0 ? (
            <section
              aria-label="Related leads"
              className="rounded-lg border border-border bg-surface p-4"
            >
              <h2 className="mb-2 text-h4">Related</h2>
              <p className="mb-2 text-caption text-fg-muted">
                {data.related.length} other lead{data.related.length === 1 ? "" : "s"} share this
                email.
              </p>
              <ul className="space-y-1 text-body-sm">
                {data.related.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span>{r.name}</span>
                    <StatusBadge kind="leads.status" value={r.status} size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
