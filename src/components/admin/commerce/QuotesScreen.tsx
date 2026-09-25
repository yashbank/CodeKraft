"use client";

import Link from "next/link";
import * as React from "react";
import { CopyIcon, FileTextIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

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
import { STATUS_ENUMS } from "@/lib/status-tone";
import { DataToolbar } from "../DataToolbar";
import { EmptyState } from "../EmptyState";
import { FilterChips } from "../FilterChips";
import { formatDate, formatDateTime, money } from "../format";
import { MoneyCell } from "../MoneyCell";
import { PageHeader } from "../PageHeader";
import { Field, RichTextField } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { CustomerOption, QuoteRow } from "../types";

export interface QuotesScreenProps {
  quotes: QuoteRow[];
  customers: CustomerOption[];
  orderHref: string;
  customerHref: string;
}

/** SCR-ADM-09 — custom quotes list with status chips, and the two-column detail/editor. */
export function QuotesScreen({ quotes, customers, orderHref, customerHref }: QuotesScreenProps) {
  const [status, setStatus] = React.useState<QuoteRow["status"] | null>(null);
  const [selected, setSelected] = React.useState<QuoteRow | null>(quotes[0] ?? null);
  const rows = quotes
    .filter((q) => (status ? q.status === status : true))
    .sort((a, b) => (a.status === "sent" ? -1 : b.status === "sent" ? 1 : 0));

  return (
    <>
      <PageHeader
        title="Custom quotes"
        description="Private negotiated offers paid through the tokenised pay page. Coupons do not apply; amounts are tax-exclusive."
        actions={
          <Button size="sm" onClick={() => setSelected(null)}>
            <PlusIcon aria-hidden /> New quote
          </Button>
        }
      />
      <FilterChips
        label="Filter by status"
        chips={STATUS_ENUMS["custom_quotes.status"].map((s) => ({
          value: s,
          label: s.charAt(0).toUpperCase() + s.slice(1),
          count: quotes.filter((q) => q.status === s).length,
        }))}
        value={status}
        onChange={setStatus}
      />
      <div className="mt-4">
        <DataToolbar searchId="quotes-search" searchPlaceholder="Title, customer…" />
        {rows.length === 0 ? (
          <EmptyState icon={FileTextIcon} title="No quotes yet" />
        ) : (
          <div className="rounded-lg border border-border bg-surface">
            <Table>
              <TableCaption className="sr-only">Custom quotes</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Linked offering</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent on</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((q) => (
                  <TableRow key={q.id} data-state={selected?.id === q.id ? "selected" : undefined}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setSelected(q)}
                        className="font-medium text-fg hover:text-accent-text"
                      >
                        {q.title}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Link href={customerHref} className="hover:text-accent-text">
                        {q.customer.name}
                      </Link>
                      <span className="block text-caption text-fg-muted">{q.customer.email}</span>
                    </TableCell>
                    <TableCell className="text-fg-muted">{q.offering ?? "—"}</TableCell>
                    <TableCell>
                      <MoneyCell value={q.amount} />
                    </TableCell>
                    <TableCell>{formatDate(q.expiresAt)}</TableCell>
                    <TableCell>
                      <StatusBadge kind="custom_quotes.status" value={q.status} />
                    </TableCell>
                    <TableCell className="text-fg-muted">
                      {q.sentAt ? formatDate(q.sentAt) : "—"}
                    </TableCell>
                    <TableCell>
                      {q.orderNumber ? (
                        <Link
                          href={orderHref}
                          className="font-mono text-accent-text hover:underline"
                        >
                          {q.orderNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        label={`Actions for ${q.title}`}
                        actions={[
                          { label: "Open", onSelect: () => setSelected(q) },
                          {
                            label: "Send",
                            disabled: q.status !== "draft",
                            onSelect: () => toast.success(`Quote sent to ${q.customer.email}`),
                          },
                          {
                            label: "Copy pay link",
                            disabled: q.status === "draft",
                            onSelect: () => toast.success("Pay link copied"),
                          },
                          { label: "Duplicate" },
                          {
                            label: "Cancel",
                            destructive: true,
                            separatorBefore: true,
                            disabled: q.status === "paid" || q.status === "cancelled",
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <section
        aria-label={selected ? `Quote ${selected.title}` : "New quote"}
        className="mt-8 grid gap-6 lg:grid-cols-12"
      >
        <form
          className="space-y-4 rounded-lg border border-border bg-surface p-5 lg:col-span-8"
          onSubmit={(e) => e.preventDefault()}
        >
          <h2 className="text-h4">{selected ? selected.title : "New quote"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="q-customer" label="Customer" required>
              <Select
                defaultValue={selected?.customer.id ?? customers[0]?.id}
                key={selected?.id ?? "new"}
              >
                <SelectTrigger id="q-customer">
                  <SelectValue />
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
            <Field
              id="q-offering"
              label="Linked offering"
              optional
              hint="Determines the delivery type."
            >
              <Select
                defaultValue={selected?.offering ?? "none"}
                key={`o-${selected?.id ?? "new"}`}
              >
                <SelectTrigger id="q-offering">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="FitDesk Pro · Enterprise rollout">
                    FitDesk Pro · Enterprise rollout
                  </SelectItem>
                  <SelectItem value="MIS Portal · Implementation">
                    MIS Portal · Implementation
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id="q-title" label="Title" required className="sm:col-span-2">
              <Input
                id="q-title"
                defaultValue={selected?.title}
                key={`t-${selected?.id ?? "new"}`}
                required
                aria-required
              />
            </Field>
          </div>
          <RichTextField
            id="q-desc"
            label="Description (what's included)"
            defaultValue={selected?.description}
            rows={4}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="q-amount" label="Amount (INR, tax-exclusive)" required>
              <Input
                id="q-amount"
                inputMode="decimal"
                defaultValue={selected ? (selected.amount.amountMinor / 100).toFixed(2) : ""}
                key={`a-${selected?.id ?? "new"}`}
                className="text-right font-mono tnum"
              />
            </Field>
            <div className="space-y-1.5">
              <Label htmlFor="q-tax">Tax applies</Label>
              <div className="flex h-10 items-center gap-2">
                <Switch
                  id="q-tax"
                  defaultChecked={selected?.taxApplies ?? true}
                  key={`x-${selected?.id ?? "new"}`}
                />
                <span className="text-caption text-fg-muted">GSTIN rule (BR-08)</span>
              </div>
            </div>
            <Field id="q-expires" label="Expires on" required hint="Default +14 days.">
              <Input
                id="q-expires"
                type="date"
                defaultValue={selected?.expiresAt ?? "2026-10-09"}
                key={`e-${selected?.id ?? "new"}`}
              />
            </Field>
          </div>
          <Field id="q-note" label="Internal note" optional>
            <Textarea
              id="q-note"
              rows={2}
              defaultValue={selected?.internalNote}
              key={`n-${selected?.id ?? "new"}`}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" onClick={() => toast.success("Quote saved as draft")}>
              Save
            </Button>
          </div>
        </form>
        <aside className="space-y-4 lg:col-span-4">
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 text-h4">
              Status{" "}
              {selected ? (
                <StatusBadge kind="custom_quotes.status" value={selected.status} size="sm" />
              ) : (
                <StatusBadge kind="custom_quotes.status" value="draft" size="sm" />
              )}
            </h2>
            {selected && selected.timeline.length > 0 ? (
              <ol className="space-y-2 text-body-sm">
                {selected.timeline.map((t) => (
                  <li key={t.at} className="flex justify-between gap-3">
                    <span>{t.text}</span>
                    <time dateTime={t.at} className="shrink-0 text-caption text-fg-muted">
                      {formatDateTime(t.at)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-body-sm text-fg-muted">Created · not sent yet.</p>
            )}
            <div className="mt-4 space-y-2">
              <Label htmlFor="q-link">Pay link</Label>
              <div className="flex gap-2">
                <Input
                  id="q-link"
                  readOnly
                  value={selected?.payLink ?? "Available after sending"}
                  className="font-mono"
                />
                <Button
                  variant="ghost"
                  size="icon-md"
                  aria-label="Copy pay link"
                  disabled={!selected || selected.status === "draft"}
                  onClick={() => toast.success("Pay link copied")}
                >
                  <CopyIcon aria-hidden className="size-4" />
                </Button>
              </div>
              <p className="text-caption text-fg-muted">
                Requires login; only the invited customer can accept.
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {selected?.status === "sent" ? (
                <Button
                  variant="secondary"
                  onClick={() => toast.success(`Quote re-sent to ${selected.customer.email}`)}
                >
                  Resend
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    toast.success(
                      `Email the quote to ${selected?.customer.email ?? "the customer"}? Sent.`,
                    )
                  }
                  disabled={selected !== null && selected.status !== "draft"}
                >
                  Send to customer
                </Button>
              )}
              <Button
                variant="destructive"
                disabled={
                  !selected || selected.status === "paid" || selected.status === "cancelled"
                }
                onClick={() => toast("Cancelled — the pay link stops working")}
              >
                Cancel quote
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-2 text-h4">Email preview</h2>
            <div className="rounded-md border border-border bg-canvas p-3 text-body-sm">
              <p className="font-semibold">Your quote from CodeKraft</p>
              <p className="mt-1 text-fg-muted">
                {selected?.title ?? "Title"} · {selected ? money(selected.amount) : "₹0.00"}
                {selected?.taxApplies ? " + tax" : ""} · valid until{" "}
                {selected ? formatDate(selected.expiresAt) : "—"}
              </p>
              <p className="mt-2 text-accent-text">Review and pay →</p>
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}
