"use client";

import Link from "next/link";
import * as React from "react";
import { ClipboardCheckIcon, ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";
import { Banner } from "../Banner";
import { EmptyState } from "../EmptyState";
import { FilterChips } from "../FilterChips";
import { formatDateTime, hoursSince, initials, timeAgo } from "../format";
import { PageHeader } from "../PageHeader";
import type { AdminUserRef, ApprovalItem, ApprovalType } from "../types";

const TYPE_LABEL: Record<ApprovalType, string> = {
  "product.publish": "Publish",
  "ownership.change": "Ownership change",
  "project_order.split": "Project order split",
  "ledger.adjustment": "Ledger adjustment",
  "refund.issue": "Refund",
  "payout.record": "Payout",
  "product.archive": "Archive",
  "product.delete": "Delete",
  "admin.user_change": "Admin user change",
};
const MONEY_TYPES: ApprovalType[] = [
  "ledger.adjustment",
  "refund.issue",
  "payout.record",
  "project_order.split",
];

export interface ApprovalsInboxProps {
  approvals: ApprovalItem[];
  currentUser: AdminUserRef;
  now: string;
}

/**
 * SCR-ADM-05 — approvals inbox. Tabs (For my approval / Requested by me / History), type chips,
 * two-pane list + detail with a per-type diff table and the decision box. The requester never
 * sees an Approve button on their own request (D-1102). Read-mostly single-pane layout below `lg`.
 */
export function ApprovalsInbox({ approvals, currentUser, now }: ApprovalsInboxProps) {
  const [tab, setTab] = React.useState<"mine" | "requested" | "history">("mine");
  const [type, setType] = React.useState<ApprovalType | null>(null);
  const [decided, setDecided] = React.useState<Record<string, "approve" | "reject">>({});
  const [comment, setComment] = React.useState("");
  const [commentError, setCommentError] = React.useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = React.useState(false);

  const isMine = (a: ApprovalItem) => a.requestedBy.id === currentUser.id;
  const byTab = approvals.filter((a) =>
    tab === "mine"
      ? a.status === "pending" && !isMine(a) && !decided[a.id]
      : tab === "requested"
        ? isMine(a)
        : a.status !== "pending" || decided[a.id],
  );
  const list = byTab.filter((a) => (type ? a.type === type : true));
  const [selectedId, setSelectedId] = React.useState<string | null>(list[0]?.id ?? null);
  const selected = approvals.find((a) => a.id === selectedId) ?? list[0] ?? null;

  const counts = {
    mine: approvals.filter((a) => a.status === "pending" && !isMine(a) && !decided[a.id]).length,
    requested: approvals.filter(isMine).length,
    history: approvals.filter((a) => a.status !== "pending" || decided[a.id]).length,
  };

  const decide = (a: ApprovalItem, decision: "approve" | "reject") => {
    if (decision === "reject" && comment.trim() === "") {
      setCommentError("A comment is required to reject.");
      return;
    }
    setCommentError(null);
    setDecided((d) => ({ ...d, [a.id]: decision }));
    setComment("");
    toast.success(
      decision === "approve"
        ? `Approved — ${TYPE_LABEL[a.type].toLowerCase()} of ${a.subject}`
        : `Rejected — ${a.subject}`,
    );
  };

  const detail = selected ? (
    <ApprovalDetail
      approval={selected}
      now={now}
      isRequester={isMine(selected)}
      localDecision={decided[selected.id]}
      comment={comment}
      onComment={setComment}
      commentError={commentError}
      onDecide={(d) => decide(selected, d)}
      currentUser={currentUser}
    />
  ) : (
    <EmptyState icon={ClipboardCheckIcon} title="Select a request" className="h-full" />
  );

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Every dual-approval action (BR-13). J/K move, Enter opens."
        className="hidden lg:flex"
      />
      <h1 className="text-h2 lg:hidden">Approvals</h1>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as typeof tab);
          setMobileDetail(false);
        }}
        className="mt-3 lg:mt-0"
      >
        <TabsList className="w-full max-w-full justify-start gap-1 overflow-x-auto sm:w-auto">
          <TabsTrigger value="mine" className="flex-none">
            For my approval ({counts.mine})
          </TabsTrigger>
          <TabsTrigger value="requested" className="flex-none">
            Requested by me ({counts.requested})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-none">
            History ({counts.history})
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mt-3">
        <FilterChips
          label="Filter by type"
          chips={(Object.keys(TYPE_LABEL) as ApprovalType[]).map((t) => ({
            value: t,
            label: TYPE_LABEL[t],
            count: byTab.filter((a) => a.type === t).length,
          }))}
          value={type}
          onChange={setType}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_3fr] xl:grid-cols-[2fr_3fr]">
        <div className={cn("min-w-0", mobileDetail && "hidden lg:block")}>
          {list.length === 0 ? (
            <EmptyState
              icon={ClipboardCheckIcon}
              title={
                tab === "mine"
                  ? "Nothing awaiting your approval"
                  : tab === "requested"
                    ? "You haven't requested anything"
                    : "No history yet"
              }
            />
          ) : (
            <ul className="space-y-2" aria-label="Approval requests">
              {list.map((a) => {
                const overdue = a.status === "pending" && hoursSince(a.requestedAt, now) > 48;
                const active = selected?.id === a.id;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      aria-current={active ? "true" : undefined}
                      aria-controls="approval-detail"
                      onClick={() => {
                        setSelectedId(a.id);
                        setMobileDetail(true);
                        setCommentError(null);
                      }}
                      className={cn(
                        "flex w-full min-w-0 items-start gap-3 rounded-lg border bg-surface p-3 text-left transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        active ? "border-accent bg-accent-soft/40" : "border-border",
                      )}
                    >
                      <Avatar size="sm">
                        <AvatarFallback>{initials(a.requestedBy.name)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge kind="approval_requests.type" value={a.type} size="sm" />
                          <span className="min-w-0 truncate text-body-sm font-semibold">
                            {a.subject}
                          </span>
                        </span>
                        <span className="block truncate text-caption text-fg-muted">
                          {a.requestedBy.name} ·{" "}
                          <span className={cn(overdue && "text-danger")}>
                            {timeAgo(a.requestedAt, now)}
                            {overdue ? " · overdue" : ""}
                          </span>
                        </span>
                      </span>
                      <StatusBadge
                        kind="approval_requests.status"
                        value={
                          decided[a.id]
                            ? decided[a.id] === "approve"
                              ? "approved"
                              : "rejected"
                            : a.status
                        }
                        size="sm"
                        hideIcon
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <section
          id="approval-detail"
          aria-label="Request detail"
          className={cn(
            "rounded-lg border border-border bg-surface p-4 lg:p-5",
            !mobileDetail && "hidden lg:block",
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 lg:hidden"
            onClick={() => setMobileDetail(false)}
          >
            <ArrowLeftIcon aria-hidden /> Back to list
          </Button>
          {detail}
        </section>
      </div>
    </>
  );
}

function ApprovalDetail({
  approval: a,
  now,
  isRequester,
  localDecision,
  comment,
  onComment,
  commentError,
  onDecide,
  currentUser,
}: {
  approval: ApprovalItem;
  now: string;
  isRequester: boolean;
  localDecision?: "approve" | "reject";
  comment: string;
  onComment: (v: string) => void;
  commentError: string | null;
  onDecide: (d: "approve" | "reject") => void;
  currentUser: AdminUserRef;
}) {
  const status = localDecision ? (localDecision === "approve" ? "applied" : "rejected") : a.status;
  const pending = status === "pending";
  const money = MONEY_TYPES.includes(a.type);
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="approval_requests.type" value={a.type} />
          <StatusBadge kind="approval_requests.status" value={status} />
        </div>
        <h2 className="text-h3">
          {a.subjectHref ? (
            <Link href={a.subjectHref} className="hover:text-accent-text hover:underline">
              {a.subject}
            </Link>
          ) : (
            a.subject
          )}
        </h2>
        <p className="text-body-sm text-fg-muted">
          Requested by {a.requestedBy.name} ·{" "}
          <time dateTime={a.requestedAt}>{formatDateTime(a.requestedAt)}</time> (
          {timeAgo(a.requestedAt, now)})
        </p>
        <blockquote className="border-l-2 border-accent pl-3 text-body italic">
          {a.comment}
        </blockquote>
      </header>

      {a.note ? <Banner tone="warning">{a.note}</Banner> : null}
      {isRequester && pending ? (
        <Banner tone="info">You requested this — another admin must approve.</Banner>
      ) : null}

      <table className="w-full text-body-sm">
        <caption className="mb-2 text-left text-overline tracking-wider text-fg-muted uppercase">
          What will change
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-caption text-fg-muted">
            <th scope="col" className="py-1.5 pr-3 font-medium">
              Field
            </th>
            {a.diff.some((d) => d.before !== undefined) ? (
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Before
              </th>
            ) : null}
            <th scope="col" className="py-1.5 font-medium">
              After
            </th>
          </tr>
        </thead>
        <tbody>
          {a.diff.map((d) => (
            <tr key={d.label} className="border-b border-border last:border-0">
              <th scope="row" className="py-2 pr-3 text-left font-medium">
                {d.label}
              </th>
              {a.diff.some((x) => x.before !== undefined) ? (
                <td className="py-2 pr-3 text-fg-muted line-through decoration-danger/60">
                  {d.before ?? "—"}
                </td>
              ) : null}
              <td className="py-2 font-mono tnum">{d.after ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {a.decision || localDecision ? (
        <Banner
          tone={status === "rejected" ? "danger" : "success"}
          title={
            status === "rejected"
              ? "Rejected"
              : a.appliedAt || localDecision
                ? "Approved and applied"
                : "Approved"
          }
        >
          {a.decision ? (
            <>
              {a.decision.by} · {formatDateTime(a.decision.at)}
              {a.decision.comment ? (
                <span className="mt-1 block font-medium">“{a.decision.comment}”</span>
              ) : null}
              {a.appliedAt ? (
                <span className="mt-1 block text-caption text-fg-muted">
                  Applied at {formatDateTime(a.appliedAt)}
                </span>
              ) : null}
            </>
          ) : (
            <>{currentUser.name} · just now</>
          )}
        </Banner>
      ) : null}

      {pending && !isRequester ? (
        <div className="space-y-3 rounded-md border border-border bg-canvas p-4">
          {money ? (
            <p className="text-body-sm text-warning">
              Approving will post ledger entries immediately. This cannot be undone.
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor={`decision-comment-${a.id}`}>
              Comment <span className="font-normal text-fg-muted">(required to reject)</span>
            </Label>
            <Textarea
              id={`decision-comment-${a.id}`}
              value={comment}
              onChange={(e) => onComment(e.target.value)}
              aria-invalid={commentError ? true : undefined}
              aria-describedby={commentError ? `decision-error-${a.id}` : undefined}
              rows={2}
            />
            {commentError ? (
              <p id={`decision-error-${a.id}`} role="alert" className="text-caption text-danger">
                {commentError}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => onDecide("approve")}
              aria-label={`Approve ${TYPE_LABEL[a.type].toLowerCase()} of ${a.subject}`}
            >
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => onDecide("reject")}
              aria-label={`Reject ${TYPE_LABEL[a.type].toLowerCase()} of ${a.subject}`}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : null}
      {pending && isRequester ? (
        <Button variant="outline" size="sm" onClick={() => toast("Request cancelled")}>
          Cancel request
        </Button>
      ) : null}
      <p className="text-caption text-fg-subtle">
        <Badge tone="ghost" size="sm">
          {a.id}
        </Badge>
      </p>
    </div>
  );
}
