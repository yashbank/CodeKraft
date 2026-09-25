"use client";

import Link from "next/link";
import * as React from "react";
import { ChevronDownIcon, RefreshCwIcon } from "lucide-react";
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
import { Banner } from "../Banner";
import { BarChart } from "../charts/BarChart";
import { Gauge } from "../charts/Gauge";
import { formatDateTime, inr, plainNumber } from "../format";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import { StatTile } from "../StatTile";
import type { ChatbotMonitorData, ConversationRow } from "../types";

const OUTCOME_LABEL: Record<
  ConversationRow["outcomes"][number],
  { label: string; tone: "info" | "success" | "warning" | "danger" }
> = {
  escalated: { label: "Escalated", tone: "info" },
  lead: { label: "Lead captured", tone: "success" },
  fallback: { label: "Fallback hit", tone: "warning" },
  cap: { label: "Cap hit", tone: "danger" },
};

export interface ChatbotMonitorProps {
  data: ChatbotMonitorData;
  settingsHref: string;
  queriesHref: string;
  leadsHref: string;
  initialTab?: "conversations" | "usage" | "prompts";
}

/** SCR-ADM-16 — chatbot monitor: conversations + transcript viewer, usage vs caps, prompt versions with activate/rollback and diff. */
export function ChatbotMonitor({
  data,
  settingsHref,
  queriesHref,
  leadsHref,
  initialTab = "conversations",
}: ChatbotMonitorProps) {
  const [selectedConv, setSelectedConv] = React.useState(data.transcript.id);
  const [openSources, setOpenSources] = React.useState<number | null>(null);
  const activePrompt = data.prompts.find((p) => p.active) ?? data.prompts[0];
  const [selectedPrompt, setSelectedPrompt] = React.useState(activePrompt?.version ?? "");
  const [activateOpen, setActivateOpen] = React.useState(false);
  const prompt = data.prompts.find((p) => p.version === selectedPrompt) ?? activePrompt;
  const u = data.usage;

  return (
    <>
      <PageHeader
        title="Chatbot"
        description="Observe the hybrid assistant, watch usage against the caps, and manage prompt versions. Model and caps are edited in Settings › AI."
      />
      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="cv-from" className="text-caption text-fg-muted">
                From
              </Label>
              <Input id="cv-from" type="date" defaultValue="2026-09-18" className="h-8 w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cv-to" className="text-caption text-fg-muted">
                To
              </Label>
              <Input id="cv-to" type="date" defaultValue="2026-09-25" className="h-8 w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cv-outcome" className="text-caption text-fg-muted">
                Outcome
              </Label>
              <Select>
                <SelectTrigger id="cv-outcome" size="sm" className="w-40">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OUTCOME_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="cv-search" className="text-caption text-fg-muted">
                Search in messages
              </Label>
              <Input id="cv-search" type="search" className="h-8 max-w-xs" />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-border bg-surface">
              <Table>
                <TableCaption className="sr-only">Conversations</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Turns</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Model · prompt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.conversations.map((c) => (
                    <TableRow
                      key={c.id}
                      data-state={selectedConv === c.id ? "selected" : undefined}
                    >
                      <TableCell>
                        <button
                          type="button"
                          className="text-left hover:text-accent-text"
                          onClick={() => setSelectedConv(c.id)}
                        >
                          {formatDateTime(c.startedAt)}
                        </button>
                      </TableCell>
                      <TableCell className="text-fg-muted">{c.customer ?? "Anonymous"}</TableCell>
                      <TableCell className="text-right font-mono tnum">{c.turns}</TableCell>
                      <TableCell className="text-right font-mono tnum">
                        {plainNumber(c.tokens)}
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-wrap gap-1">
                          {c.outcomes.map((o) => (
                            <Badge key={o} tone={OUTCOME_LABEL[o].tone} size="sm">
                              {OUTCOME_LABEL[o].label}
                            </Badge>
                          ))}
                          {c.outcomes.length === 0 ? (
                            <span className="text-fg-subtle">—</span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-caption text-fg-muted">
                        {c.model} · {c.promptVersion}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <section
              aria-label={`Transcript ${selectedConv}`}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-h4">
                  Transcript <span className="font-mono text-fg-muted">{selectedConv}</span>
                </h2>
                <span className="ml-auto flex gap-1">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={queriesHref}>Open escalated query</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={leadsHref}>Open lead</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => toast("Purge is audited — confirm dialog in Phase 8")}
                  >
                    Purge now
                  </Button>
                </span>
              </div>
              <ol role="log" aria-label="Transcript" className="space-y-2">
                {data.transcript.turns.map((t, i) => (
                  <li
                    key={i}
                    className={cn(
                      "rounded-lg px-3 py-2 text-body-sm",
                      t.role === "user" && "ml-8 bg-accent text-accent-fg",
                      t.role === "assistant" && "mr-8 bg-canvas",
                      t.role === "menu" && "mr-8 bg-accent-soft text-accent-text",
                      t.role === "system" && "bg-elevated text-caption text-fg-muted",
                    )}
                  >
                    <span className="block text-caption font-semibold uppercase opacity-70">
                      {t.role}
                    </span>
                    <p>{t.text}</p>
                    {t.tokens !== undefined ? (
                      <p className="mt-1 font-mono text-caption opacity-70">
                        {t.tokens} tokens · {t.latencyMs} ms · {t.stopReason}
                      </p>
                    ) : null}
                    {t.sources ? (
                      <div className="mt-1">
                        <button
                          type="button"
                          aria-expanded={openSources === i}
                          onClick={() => setOpenSources(openSources === i ? null : i)}
                          className="inline-flex items-center gap-1 text-caption text-accent-text"
                        >
                          Sources ({t.sources.length}){" "}
                          <ChevronDownIcon
                            aria-hidden
                            className={cn(
                              "size-3 transition-transform",
                              openSources === i && "rotate-180",
                            )}
                          />
                        </button>
                        {openSources === i ? (
                          <ol className="mt-1 list-decimal pl-5 text-caption text-fg-muted">
                            {t.sources.map((s) => (
                              <li key={s}>{s}</li>
                            ))}
                          </ol>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          {u.providerDownSince ? (
            <Banner tone="danger">
              Anthropic API unreachable since {u.providerDownSince} — bot is in menu-only mode.
            </Banner>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Today"
              value={`${plainNumber(u.today)} / ${plainNumber(u.cap)}`}
              hint="platform messages"
            >
              <Gauge
                value={u.today}
                max={u.cap}
                label="Platform cap"
                format={plainNumber}
                className="mt-2"
              />
            </StatTile>
            <StatTile
              label="Users at cap"
              value={u.usersAtCap}
              hint={`${u.perUserCap}/day per user`}
            />
            <StatTile label="30-day messages" value={plainNumber(u.monthMessages)} />
            <StatTile
              label="Estimated cost"
              value={inr(u.estimatedCostInr)}
              hint="Estimate based on configured model pricing"
            />
            <StatTile label="Fallback rate" value={`${Math.round(u.fallbackRate * 100)} %`} />
            <StatTile label="Escalation rate" value={`${Math.round(u.escalationRate * 100)} %`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-lg border border-border bg-surface p-4">
              <h2 className="mb-2 text-h4">Daily messages (30 d) · cap {plainNumber(u.cap)}</h2>
              <BarChart
                data={u.daily}
                series={7}
                height={180}
                formatValue={plainNumber}
                summary={`Daily messages over 30 days; the cap of ${u.cap} was hit on ${u.daily.filter((d) => d.value >= u.cap).length} days.`}
                caption="Daily chatbot messages"
              />
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface p-4">
                <h2 className="mb-2 text-h4">Top users</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Msgs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {u.topUsers.map((t) => (
                      <TableRow key={t.email} className="h-9">
                        <TableCell className="font-mono text-caption">
                          {t.email}
                          {t.atCap ? (
                            <Badge tone="danger" size="sm" className="ml-2">
                              at cap
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-mono tnum">{t.messages}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <h2 className="mb-2 text-h4">Model breakdown</h2>
                <ul className="space-y-1 text-body-sm">
                  {u.models.map((m) => (
                    <li key={m.label} className="flex justify-between">
                      <span className="font-mono">{m.label}</span>
                      <span className="font-mono tnum">{plainNumber(m.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button asChild variant="link" size="sm">
                <Link href={settingsHref}>Adjust caps in Settings › AI</Link>
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface">
                <Table>
                  <TableCaption className="sr-only">Prompt versions</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.prompts.map((p) => (
                      <TableRow
                        key={p.version}
                        data-state={p.version === selectedPrompt ? "selected" : undefined}
                      >
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setSelectedPrompt(p.version)}
                            className="inline-flex items-center gap-2 font-mono hover:text-accent-text"
                          >
                            {p.version}
                            {p.active ? (
                              <Badge tone="success" size="sm">
                                Active
                              </Badge>
                            ) : null}
                          </button>
                        </TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="text-fg-muted">
                          {p.createdBy} · {formatDateTime(p.createdAt)}
                        </TableCell>
                        <TableCell className="whitespace-normal text-fg-muted">
                          {p.notes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <h2 className="mb-2 text-h4">Knowledge index</h2>
                <p className="text-body-sm text-fg-muted">
                  Last rebuilt {formatDateTime(data.lastIndexRun)} · {data.indexChunks} chunks
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => toast.success(`Index rebuilt (${data.indexChunks} chunks)`)}
                >
                  <RefreshCwIcon aria-hidden /> Rebuild knowledge index
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <h2 className="mb-2 text-h4">Try a message</h2>
                <p className="mb-2 text-caption text-fg-muted">
                  Dry run against {prompt?.version}; counts toward the platform cap and is flagged
                  as test.
                </p>
                <Label htmlFor="pt-msg" className="sr-only">
                  Test message
                </Label>
                <div className="flex gap-2">
                  <Input id="pt-msg" placeholder="Can I get a refund?" />
                  <Button
                    size="md"
                    variant="secondary"
                    onClick={() => toast("Answer + sources appear here")}
                  >
                    Run
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-h4">Editor · {prompt?.version}</h2>
                {prompt?.active ? (
                  <Badge tone="success" size="sm">
                    Active
                  </Badge>
                ) : null}
                <span className="ml-auto flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => toast.success("Saved as v5")}
                  >
                    Save as new version
                  </Button>
                  {prompt && !prompt.active ? (
                    <Button size="sm" onClick={() => setActivateOpen(true)}>
                      Activate
                    </Button>
                  ) : null}
                  {prompt && !prompt.active ? (
                    <Button size="sm" variant="outline" onClick={() => setActivateOpen(true)}>
                      Roll back to this version
                    </Button>
                  ) : null}
                </span>
              </div>
              <Field
                id="pt-body"
                label="System prompt"
                hint="The system prompt must keep the bot grounded on site content; the retrieval context is appended automatically. Max 10,000 chars."
              >
                <Textarea
                  id="pt-body"
                  rows={9}
                  defaultValue={prompt?.body}
                  key={prompt?.version}
                  className="font-mono text-body-sm"
                  maxLength={10000}
                />
              </Field>
              <Field id="pt-notes" label="Version notes">
                <Input id="pt-notes" defaultValue={prompt?.notes} key={`n-${prompt?.version}`} />
              </Field>
              {prompt && activePrompt && prompt.version !== activePrompt.version ? (
                <div>
                  <h3 className="mb-2 text-body-sm font-semibold">
                    Diff vs active ({activePrompt.version})
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 font-mono text-caption">
                    <pre className="overflow-auto rounded-md bg-danger-soft p-2 whitespace-pre-wrap text-danger">
                      <span className="sr-only">Removed: </span>− {activePrompt.body}
                    </pre>
                    <pre className="overflow-auto rounded-md bg-success-soft p-2 whitespace-pre-wrap text-success">
                      <span className="sr-only">Added: </span>+ {prompt.body}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate {prompt?.version}?</DialogTitle>
            <DialogDescription>
              All new conversations will use it. Existing conversations keep their version.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                toast.success(`${prompt?.version} activated`);
                setActivateOpen(false);
              }}
            >
              Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
