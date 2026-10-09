"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ChevronDownIcon, TruckIcon } from "lucide-react";
import { toast } from "sonner";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { completeDeliveryTask, assignDeliveryTask } from "@/modules/delivery/admin-mutations";
import { EmptyState } from "../EmptyState";
import { FilterChips } from "../FilterChips";
import { formatDate, hoursSince, timeAgo } from "../format";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import type { AdminUserRef, DeliveryTaskRow } from "../types";

export interface DeliveryTasksScreenProps {
  tasks: DeliveryTaskRow[];
  admins: AdminUserRef[];
  now: string;
  orderHref: string;
  customerHref: string;
}

/**
 * SCR-ADM-12 (tasks half) — the delivery-task queue: provision / revoke-external tasks a human
 * must act on. The entitlements half of SCR-ADM-12 lives in `EntitlementsScreen` (a different
 * phase's scope); this is a standalone screen wired to real `modules/delivery` data and actions.
 */
export function DeliveryTasksScreen({
  tasks,
  admins,
  now,
  orderHref,
  customerHref,
}: DeliveryTasksScreenProps) {
  const router = useRouter();
  const [taskTab, setTaskTab] = React.useState<"open" | "done">("open");
  const [kind, setKind] = React.useState<DeliveryTaskRow["kind"] | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [doneTask, setDoneTask] = React.useState<DeliveryTaskRow | null>(null);
  const [doneSubmitting, setDoneSubmitting] = React.useState(false);
  const [assigningId, setAssigningId] = React.useState<string | null>(null);

  const taskRows = tasks
    .filter((t) => t.status === taskTab)
    .filter((t) => (kind ? t.kind === kind : true));

  async function handleAssign(taskId: string, adminId: string | null) {
    setAssigningId(taskId);
    const result = await assignDeliveryTask({ taskId, assignedTo: adminId });
    setAssigningId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(adminId ? "Task assigned" : "Task unassigned");
    router.refresh();
  }

  async function handleMarkDone(note: string) {
    if (!doneTask) return;
    setDoneSubmitting(true);
    const result = await completeDeliveryTask({
      taskId: doneTask.id,
      ...(note ? { note } : {}),
    });
    setDoneSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Task marked done");
    setDoneTask(null);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Delivery tasks"
        description="Tasks the platform raises when a human must act: provision an account or disable an external one."
      />
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
                        <span className="block text-caption text-fg-muted">{t.customer.email}</span>
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
                        <Select
                          value={t.assignedTo ?? "none"}
                          disabled={assigningId === t.id}
                          onValueChange={(v) => {
                            const adminId =
                              v === "none" ? null : (admins.find((a) => a.name === v)?.id ?? null);
                            handleAssign(t.id, adminId);
                          }}
                        >
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
                          {t.orderId ? (
                            <Button asChild variant="ghost" size="sm">
                              <Link href={orderHref}>Open order</Link>
                            </Button>
                          ) : null}
                          {t.status === "open" ? (
                            <Button size="sm" variant="secondary" onClick={() => setDoneTask(t)}>
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
                            {t.kind === "revoke_external"
                              ? `Revoke access in the SaaS for ${t.customer.email}, then mark done.`
                              : "See the offering's delivery config."}
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
          <form
            id="delivery-task-done-form"
            onSubmit={(e) => {
              e.preventDefault();
              const note = String(new FormData(e.currentTarget).get("note") ?? "").trim();
              if (doneTask?.kind === "revoke_external" && !note) {
                toast.error("A note is required when revoking external access.");
                return;
              }
              handleMarkDone(note);
            }}
          >
            <Field id="task-note" label="Note" required={doneTask?.kind === "revoke_external"}>
              <Textarea id="task-note" name="note" rows={2} />
            </Field>
          </form>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" form="delivery-task-done-form" disabled={doneSubmitting}>
              Mark done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
