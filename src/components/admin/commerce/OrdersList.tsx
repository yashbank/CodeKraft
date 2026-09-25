"use client";

import Link from "next/link";
import * as React from "react";
import { DownloadIcon, PlusIcon, ShoppingCartIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { Banner } from "../Banner";
import { DataToolbar, ToolbarField } from "../DataToolbar";
import { EmptyState } from "../EmptyState";
import { FilterChips } from "../FilterChips";
import { daysUntil, formatDate, money, timeAgo } from "../format";
import { LaptopNotice } from "../LaptopNotice";
import { MoneyCell } from "../MoneyCell";
import { PageHeader } from "../PageHeader";
import { RowActions } from "../RowActions";
import type { OrderRow, OrderStatus } from "../types";
import { ConfirmPaymentDialog } from "./ConfirmPaymentDialog";

type Queue = "awaiting" | OrderStatus;

export interface OrdersListProps {
  orders: OrderRow[];
  now: string;
  detailHref: string;
  newOrderHref: string;
  customerHref: string;
  approvalsHref: string;
  notificationsHref: string;
}

/**
 * SCR-ADM-06 — orders list. Desktop: queue chips (Awaiting confirmation highlighted), toolbar,
 * DataTable with payment cell and inline Confirm. Below `lg`: read-mostly cards for the
 * awaiting-confirmation queue with the single "Confirm payment" action.
 */
export function OrdersList({
  orders,
  now,
  detailHref,
  newOrderHref,
  customerHref,
  approvalsHref,
  notificationsHref,
}: OrdersListProps) {
  const [queue, setQueue] = React.useState<Queue | null>("awaiting");
  const [confirming, setConfirming] = React.useState<OrderRow | null>(null);
  const awaiting = orders.filter((o) => o.awaitingConfirmation);
  const rows =
    queue === "awaiting" ? awaiting : queue ? orders.filter((o) => o.status === queue) : orders;
  const chips: Array<{ value: Queue; label: string; count: number; tone?: "warning" }> = [
    { value: "awaiting", label: "Awaiting confirmation", count: awaiting.length, tone: "warning" },
    ...(
      ["pending_payment", "paid", "fulfilled", "failed", "cancelled", "refunded"] as OrderStatus[]
    ).map((s) => ({
      value: s,
      label: {
        pending_payment: "Pending payment",
        paid: "Paid",
        fulfilled: "Fulfilled",
        failed: "Failed",
        cancelled: "Cancelled",
        refunded: "Refunded",
        partially_refunded: "Partially refunded",
      }[s],
      count: orders.filter((o) => o.status === s).length,
    })),
  ];

  const confirmDialog = confirming ? (
    <ConfirmPaymentDialog
      key={confirming.id}
      open
      onOpenChange={(o) => !o && setConfirming(null)}
      orderNumber={confirming.number}
      due={confirming.total}
      customerReference={confirming.payment.reference}
      onConfirm={() => toast.success(`${confirming.number} marked Paid · invoice CK/2026-27/0007`)}
    />
  ) : null;

  return (
    <>
      {/* Phone / tablet: read-mostly awaiting-confirmation queue */}
      <div className="lg:hidden">
        <h1 className="text-h2">Orders · awaiting confirmation</h1>
        <p className="mt-1 mb-4 text-body-sm text-fg-muted">
          {awaiting.length} payments to verify. Other queues, filters and export open on a laptop.
        </p>
        {awaiting.length === 0 ? (
          <EmptyState icon={ShoppingCartIcon} title="No payments awaiting confirmation" />
        ) : (
          <ul className="space-y-3">
            {awaiting.map((o) => (
              <li key={o.id} className="space-y-2 rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-body font-semibold">{o.number}</span>
                  <StatusBadge kind="orders.status" value={o.status} size="sm" />
                </div>
                <p className="text-body-sm">
                  {o.customer.name} <span className="text-fg-muted">· {o.customer.email}</span>
                </p>
                <p className="font-mono text-body tnum">{money(o.total)}</p>
                <p className="flex flex-wrap items-center gap-2 text-body-sm">
                  <StatusBadge kind="payments.provider" value={o.payment.provider} size="sm" />
                  <StatusBadge kind="payments.status" value={o.payment.status} size="sm" />
                  {o.payment.reference ? (
                    <span className="font-mono text-caption text-fg-muted">
                      {o.payment.reference}
                    </span>
                  ) : null}
                </p>
                <Button className="w-full" onClick={() => setConfirming(o)}>
                  Confirm payment
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8">
          <LaptopNotice
            as="h2"
            title="Full orders list"
            summary={`${orders.length} orders in total.`}
            approvalsHref={approvalsHref}
            notificationsHref={notificationsHref}
          />
        </div>
      </div>

      <div className="hidden lg:block">
        <PageHeader
          title="Orders"
          description="Every release-1 order needs a human payment confirmation. The awaiting queue polls every 10 s."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast("Export queued — includes INR and native totals")}
              >
                <DownloadIcon aria-hidden /> Export CSV
              </Button>
              <Button asChild size="sm">
                <Link href={newOrderHref}>
                  <PlusIcon aria-hidden /> New manual order
                </Link>
              </Button>
            </>
          }
        />
        <FilterChips label="Order queue" chips={chips} value={queue} onChange={setQueue} />
        <div className="mt-4">
          <DataToolbar
            searchId="orders-search"
            searchPlaceholder="Order no, customer email, product…"
            filters={
              <>
                <ToolbarField id="orders-type" label="Type">
                  <Select>
                    <SelectTrigger id="orders-type" size="sm" className="w-32">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                    </SelectContent>
                  </Select>
                </ToolbarField>
                <ToolbarField id="orders-method" label="Method">
                  <Select>
                    <SelectTrigger id="orders-method" size="sm" className="w-32">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual_upi">UPI</SelectItem>
                      <SelectItem value="manual_bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </ToolbarField>
                <ToolbarField id="orders-from" label="From">
                  <Input id="orders-from" type="date" className="h-8 w-40" />
                </ToolbarField>
                <ToolbarField id="orders-to" label="To">
                  <Input id="orders-to" type="date" className="h-8 w-40" />
                </ToolbarField>
              </>
            }
          />
          {queue === "awaiting" ? (
            <Banner tone="info" className="mb-3">
              Payments where the customer submitted a reference or that are older than 1 day without
              one.
            </Banner>
          ) : null}
          {rows.length === 0 ? (
            <EmptyState
              icon={ShoppingCartIcon}
              title={queue === "awaiting" ? "No payments awaiting confirmation" : "No orders match"}
            />
          ) : (
            <div className="rounded-lg border border-border bg-surface">
              <Table>
                <TableCaption className="sr-only">Orders</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order no</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o) => {
                    const days = o.expiresAt ? daysUntil(o.expiresAt, now) : null;
                    const urgent = days !== null && days < 1;
                    return (
                      <TableRow key={o.id}>
                        <TableCell>
                          <Link
                            href={detailHref}
                            className="font-mono font-medium text-fg hover:text-accent-text"
                          >
                            {o.number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-fg-muted">
                          <time dateTime={o.placedAt} title={formatDate(o.placedAt)}>
                            {timeAgo(o.placedAt, now)}
                          </time>
                        </TableCell>
                        <TableCell>
                          <Link href={customerHref} className="block hover:text-accent-text">
                            {o.customer.name}
                            {o.type === "project" ? (
                              <StatusBadge
                                kind="orders.type"
                                value="project"
                                size="sm"
                                className="ml-2"
                              />
                            ) : null}
                          </Link>
                          <span className="block text-caption text-fg-muted">
                            {o.customer.email}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-56 truncate">
                          {o.items[0]}
                          {o.items.length > 1 ? (
                            <span className="text-fg-muted"> +{o.items.length - 1}</span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <MoneyCell value={o.total} />
                        </TableCell>
                        <TableCell>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Badge tone="neutral" size="sm">
                              {o.payment.provider === "manual_upi" ? "UPI" : "Bank"}
                            </Badge>
                            <StatusBadge
                              kind="payments.status"
                              value={o.payment.status}
                              size="sm"
                            />
                            {o.payment.reference ? (
                              <span className="font-mono text-caption text-fg-muted">
                                {o.payment.reference}
                              </span>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="orders.status" value={o.status} />
                        </TableCell>
                        <TableCell className={cn(urgent && "text-danger")}>
                          {o.status === "pending_payment" && days !== null ? (
                            <>
                              {days <= 0 ? "Expires today" : `Expires in ${days} d`}
                              {urgent ? " · urgent" : ""}
                            </>
                          ) : (
                            <span className="text-fg-subtle">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <RowActions
                            label={`Actions for ${o.number}`}
                            actions={[
                              { label: "Open", href: detailHref },
                              {
                                label: "Confirm payment",
                                onSelect: () => setConfirming(o),
                                disabled: !(
                                  o.payment.status === "submitted" ||
                                  o.payment.status === "initiated"
                                ),
                              },
                              { label: "Mark failed", disabled: o.status !== "pending_payment" },
                              {
                                label: "Cancel",
                                destructive: true,
                                disabled: o.status !== "pending_payment",
                                separatorBefore: true,
                              },
                              {
                                label: "Download invoice",
                                disabled: !o.invoiceNumber,
                                separatorBefore: true,
                              },
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t border-border px-3 py-2 text-body-sm text-fg-muted">
                <span>{rows.length} orders</span>
                <span>25 per page</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {confirmDialog}
    </>
  );
}
