"use client";

import { FileTextIcon, ReceiptIcon } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import { format } from "@/lib/money";
import { Banner } from "./Banner";
import { EmptyState } from "./EmptyState";
import { formatDate } from "./format";
import type { InvoiceSummary, PaymentSummary } from "./types";

const PROVIDER = { manual_upi: "UPI", manual_bank: "Bank transfer" } as const;

function paymentAction(
  p: PaymentSummary,
): { label: string; href: string; primary: boolean } | null {
  switch (p.status) {
    case "initiated":
      return { label: "Submit reference", href: p.orderHref, primary: true };
    case "submitted":
      return { label: "Edit reference", href: p.orderHref, primary: false };
    case "failed":
      return p.orderOpen
        ? { label: "Retry", href: p.orderHref, primary: true }
        : { label: "Buy again", href: "/products", primary: false };
    case "confirmed":
      return { label: "Invoice", href: p.orderHref, primary: false };
    default:
      return null;
  }
}

/**
 * SCR-ACC-04 — invoices & payments: two tabs. Invoices table (number, date, order, description,
 * amount + ≈ display estimate, tax, status, PDF) with credit-note rows; payments table with the
 * per-status action, an info banner while any reference awaits confirmation, and an inline
 * "submit reference" panel for the initiated payment.
 */
export function InvoicesScreen({
  invoices,
  payments,
  financialYears,
  links,
  loading = false,
  error,
  pdfError = false,
}: {
  invoices: InvoiceSummary[];
  payments: PaymentSummary[];
  financialYears: string[];
  links: { order: (orderNumber: string) => string };
  loading?: boolean;
  error?: string | null;
  pdfError?: boolean;
}) {
  const [fy, setFy] = React.useState(financialYears[0] ?? "all");
  const [reference, setReference] = React.useState("");
  const pending = payments.find((p) => p.status === "initiated");
  const anySubmitted = payments.some((p) => p.status === "submitted");

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-fg">Invoices &amp; payments</h1>
      {error ? (
        <Banner
          tone="danger"
          action={
            <Button size="sm" variant="secondary">
              Try again
            </Button>
          }
        >
          {error}
        </Banner>
      ) : null}
      {pdfError ? (
        <Banner tone="warning">Invoice PDF is being regenerated — try again in a minute.</Banner>
      ) : null}

      <Tabs defaultValue="invoices">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList variant="line">
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Label htmlFor="fy" className="text-caption text-fg-muted">
              Financial year
            </Label>
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger id="fy" size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {financialYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
                <SelectItem value="all">All years</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="invoices" className="mt-4">
          {loading ? (
            <TableSkeleton />
          ) : invoices.length === 0 ? (
            <EmptyState icon={ReceiptIcon} title="No invoices yet" />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Invoice no</TableHead>
                      <TableHead scope="col">Date</TableHead>
                      <TableHead scope="col">Order</TableHead>
                      <TableHead scope="col">Description</TableHead>
                      <TableHead scope="col" className="text-right">
                        Amount
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        Tax
                      </TableHead>
                      <TableHead scope="col">Status</TableHead>
                      <TableHead scope="col" className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id} className="h-13">
                        <TableCell className="font-mono text-body-sm">
                          {inv.number}
                          {inv.kind === "credit_note" ? (
                            <Badge tone="danger" size="sm" className="ml-2">
                              Credit note
                            </Badge>
                          ) : null}
                          {inv.forInvoiceNumber ? (
                            <span className="block text-caption text-fg-muted">
                              for {inv.forInvoiceNumber}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-body-sm">{formatDate(inv.date)}</TableCell>
                        <TableCell>
                          <Link
                            href={links.order(inv.orderNumber)}
                            className="font-mono text-body-sm text-accent-text hover:underline"
                          >
                            {inv.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-body-sm">
                          {inv.description}
                        </TableCell>
                        <TableCell className="text-right font-mono text-body-sm tnum">
                          <span className={inv.amount.amountMinor < 0 ? "text-danger" : "text-fg"}>
                            {format(inv.amount)}
                          </span>
                          {inv.displayAmount ? (
                            <span className="block text-caption text-fg-muted">
                              ≈ {format(inv.displayAmount)}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-mono text-body-sm tnum text-fg-muted">
                          {inv.tax ? format(inv.tax) : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="orders.status" value={inv.status} size="sm" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="secondary">
                            <FileTextIcon aria-hidden /> PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="space-y-3 md:hidden">
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="rounded-lg border border-border bg-surface p-4 shadow-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-body-sm text-fg">{inv.number}</p>
                        <p className="truncate text-caption text-fg-muted">{inv.description}</p>
                      </div>
                      <span
                        className={`font-mono text-body tnum ${inv.amount.amountMinor < 0 ? "text-danger" : "text-fg"}`}
                      >
                        {format(inv.amount)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-fg-muted">
                      {formatDate(inv.date)}
                      <StatusBadge kind="orders.status" value={inv.status} size="sm" />
                      {inv.kind === "credit_note" ? (
                        <Badge tone="danger" size="sm">
                          Credit note
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="secondary" className="flex-1">
                        <FileTextIcon aria-hidden /> PDF
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1" asChild>
                        <Link href={links.order(inv.orderNumber)}>View order</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-caption text-fg-subtle">
                Amounts are in the charge currency (INR); other currencies are estimates marked ≈.
                GST breakdown appears on the PDF when applicable.
              </p>
            </>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-4">
          {anySubmitted ? (
            <Banner tone="info">
              We confirm UPI and bank transfers manually, usually within 1 working day. You&apos;ll
              get an email when it&apos;s done.
            </Banner>
          ) : null}

          {pending ? (
            <section
              aria-labelledby="pending-ref"
              className="rounded-lg border border-warning bg-warning-soft/40 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="pending-ref" className="text-body font-semibold text-fg">
                  Payment pending for {pending.orderNumber}
                </h2>
                <StatusBadge kind="payments.status" value="initiated" size="sm" />
              </div>
              <p className="mt-1 text-body-sm text-fg-muted">
                {format(pending.amountDue)} via {PROVIDER[pending.provider]}. After paying, enter
                the UTR / transaction reference.
              </p>
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
                onSubmit={(e) => e.preventDefault()}
              >
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="pending-utr" required>
                    Transaction reference / UTR
                  </Label>
                  <Input
                    id="pending-utr"
                    className="font-mono"
                    minLength={6}
                    maxLength={64}
                    required
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={reference.trim().length < 6}>
                  Submit reference
                </Button>
                <Button type="button" variant="ghost" asChild>
                  <Link href={pending.orderHref}>Open order</Link>
                </Button>
              </form>
            </section>
          ) : null}

          {loading ? (
            <TableSkeleton />
          ) : payments.length === 0 ? (
            <EmptyState icon={ReceiptIcon} title="No payments yet" />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Date</TableHead>
                      <TableHead scope="col">Order</TableHead>
                      <TableHead scope="col">Method</TableHead>
                      <TableHead scope="col" className="text-right">
                        Amount due
                      </TableHead>
                      <TableHead scope="col">Reference</TableHead>
                      <TableHead scope="col">Status</TableHead>
                      <TableHead scope="col" className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => {
                      const action = paymentAction(p);
                      return (
                        <TableRow key={p.id} className="h-13">
                          <TableCell className="text-body-sm">{formatDate(p.date)}</TableCell>
                          <TableCell>
                            <Link
                              href={p.orderHref}
                              className="font-mono text-body-sm text-accent-text hover:underline"
                            >
                              {p.orderNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="text-body-sm">{PROVIDER[p.provider]}</TableCell>
                          <TableCell className="text-right font-mono text-body-sm tnum">
                            {format(p.amountDue)}
                          </TableCell>
                          <TableCell className="font-mono text-body-sm text-fg-muted">
                            {p.reference ?? "—"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              kind="payments.status"
                              value={p.status}
                              size="sm"
                              label={
                                p.status === "submitted"
                                  ? "Submitted — awaiting confirmation"
                                  : undefined
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {action ? (
                              <Button
                                size="sm"
                                variant={action.primary ? "primary" : "secondary"}
                                asChild
                              >
                                <Link href={action.href}>{action.label}</Link>
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <ul className="space-y-3 md:hidden">
                {payments.map((p) => {
                  const action = paymentAction(p);
                  return (
                    <li
                      key={p.id}
                      className="rounded-lg border border-border bg-surface p-4 shadow-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-body-sm text-fg">{p.orderNumber}</p>
                          <p className="text-caption text-fg-muted">
                            {formatDate(p.date)} · {PROVIDER[p.provider]}
                          </p>
                        </div>
                        <span className="font-mono text-body tnum text-fg">
                          {format(p.amountDue)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge kind="payments.status" value={p.status} size="sm" />
                        {p.reference ? (
                          <span className="font-mono text-caption text-fg-muted">
                            {p.reference}
                          </span>
                        ) : null}
                      </div>
                      {action ? (
                        <Button
                          size="sm"
                          variant={action.primary ? "primary" : "secondary"}
                          className="mt-3 w-full"
                          asChild
                        >
                          <Link href={action.href}>{action.label}</Link>
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}
