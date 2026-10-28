"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  cancelQuote,
  createQuote,
  searchQuoteCustomers,
  sendQuote,
} from "@/modules/quotes/admin-mutations";
import { Banner } from "../Banner";
import { DataToolbar } from "../DataToolbar";
import { EmptyState } from "../EmptyState";
import { FilterChips } from "../FilterChips";
import { formatDate, formatDateTime, money } from "../format";
import { MoneyCell } from "../MoneyCell";
import { PageHeader } from "../PageHeader";
import { Field, RichTextField } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { CustomerOption, QuoteOfferingOption, QuoteRow } from "../types";
import { SiteName } from "@/components/brand/site-brand";

export interface QuotePrefill {
  customerId?: string;
  title?: string;
  description?: string;
}

export interface QuotesScreenProps {
  /** Opens the editor as a new quote with these fields filled (e.g. from a lead). */
  prefill?: QuotePrefill;
  quotes: QuoteRow[];
  customers: CustomerOption[];
  offerings?: QuoteOfferingOption[];
  /** Set when the quotes list failed to load, so the page never looks silently empty. */
  loadError?: string;
  orderHref: string;
  customerHref: string;
}

/** "Default +14 days" per the Expires-on field hint, as a `yyyy-MM-dd` string for the date input. */
function defaultExpiresOn(): string {
  const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** SCR-ADM-09 — custom quotes list with status chips, and the two-column detail/editor. */
export function QuotesScreen({
  quotes,
  customers: initialCustomers,
  offerings = [],
  loadError,
  orderHref,
  customerHref,
  prefill,
}: QuotesScreenProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState<QuoteRow["status"] | null>(null);
  const [selected, setSelected] = React.useState<QuoteRow | null>(
    prefill ? null : (quotes[0] ?? null),
  );
  const [pending, setPending] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const rows = quotes
    .filter((q) => (status ? q.status === status : true))
    .sort((a, b) => (a.status === "sent" ? -1 : b.status === "sent" ? 1 : 0));

  const [customers, setCustomers] = React.useState<CustomerOption[]>(initialCustomers);
  const [customerId, setCustomerId] = React.useState(prefill?.customerId ?? "");
  const [customerQuery, setCustomerQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [offeringId, setOfferingId] = React.useState("none");
  const [currency, setCurrency] = React.useState<"INR" | "USD" | "EUR" | "GBP" | "CAD">("INR");
  const [taxPct, setTaxPct] = React.useState("0");
  const [lines, setLines] = React.useState<Array<{ d: string; q: string; u: string }>>([]);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Server-side search so any existing customer (not just the first page) can be picked.
  React.useEffect(() => {
    const q = customerQuery.trim();
    if (!q) {
      setCustomers(initialCustomers);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await searchQuoteCustomers({ q });
      if (cancelled) return;
      setSearching(false);
      if (!res.ok) {
        setFormError(`Customer search failed: ${res.error.message}`);
        return;
      }
      setCustomers(res.data as CustomerOption[]);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [customerQuery, initialCustomers]);

  /** Resets the editor for a fresh quote (also used after a successful create). */
  function resetForm() {
    setSelected(null);
    setOfferingId("none");
    setLines([]);
    setTaxPct("0");
    setFormError(null);
  }

  const lineTotalMinor = lines.reduce(
    (n, l) => n + Math.round((parseInt(l.q, 10) || 0) * (parseFloat(l.u) || 0) * 100),
    0,
  );

  /** Creates a quote from the form; `alsoSend` sends it right after. Quotes are immutable once created. */
  async function handleCreate(alsoSend: boolean) {
    const form = formRef.current;
    if (!form) return;
    setFormError(null);
    const fail = (msg: string) => {
      setFormError(msg);
      toast.error(msg);
    };
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const amountStr = String(data.get("amount") ?? "").trim();
    const expiresAtStr = String(data.get("expiresAt") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const internalNote = String(data.get("internalNote") ?? "").trim();

    if (!customerId) return fail("Choose a customer first");
    if (!title) return fail("Title is required");
    const taxBps = Math.round((parseFloat(taxPct) || 0) * 100);
    if (taxBps < 0 || taxBps > 10000) return fail("Tax must be between 0% and 100%");
    if (!expiresAtStr) return fail("Validity date is required");
    const expiresAt = new Date(`${expiresAtStr}T23:59:59.000Z`);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return fail("Validity date must be in the future");
    }

    let lineItems: Array<{ description: string; quantity: number; unitMinor: number }> | undefined;
    let amountMinor: number | undefined;
    if (lines.length > 0) {
      lineItems = [];
      for (const [i, l] of lines.entries()) {
        const quantity = parseInt(l.q, 10);
        const unitMinor = Math.round(parseFloat(l.u) * 100);
        if (!l.d.trim() || !(quantity > 0) || !Number.isFinite(unitMinor) || unitMinor <= 0) {
          return fail(`Line ${i + 1}: enter a description, a quantity and a price above zero`);
        }
        lineItems.push({ description: l.d.trim(), quantity, unitMinor });
      }
    } else {
      amountMinor = Math.round(parseFloat(amountStr) * 100);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
        return fail("Enter a price above zero, or add line items");
      }
    }

    setPending(true);
    const result = await createQuote({
      customerId,
      offeringId: offeringId !== "none" ? offeringId : undefined,
      title,
      description: description || undefined,
      currency,
      amountMinor,
      lineItems,
      taxBps,
      internalNote: internalNote || undefined,
      expiresAt: expiresAt.toISOString(),
    });
    if (!result.ok) {
      setPending(false);
      return fail(result.error.message);
    }
    if (alsoSend) {
      const sent = await sendQuote({ quoteId: result.data.quoteId });
      setPending(false);
      if (!sent.ok) {
        // Draft exists; tell the admin exactly what failed and that it can be re-sent.
        fail(`Quote saved as draft but sending failed: ${sent.error.message}`);
        router.refresh();
        return;
      }
      toast.success("Quote created and sent to the customer");
    } else {
      setPending(false);
      toast.success("Quote saved as draft");
    }
    resetForm();
    router.refresh();
  }

  function handleSaveClick() {
    if (selected) {
      toast.error(
        "Editing an existing quote isn't supported — quotes are immutable after creation. Cancel it and create a new one instead.",
      );
      return;
    }
    void handleCreate(false);
  }

  async function handleSend(id: string, email: string, resend = false, newExpiry?: string) {
    setPending(true);
    setFormError(null);
    const result = await sendQuote({
      quoteId: id,
      expiresAt: newExpiry ? new Date(`${newExpiry}T23:59:59.000Z`).toISOString() : undefined,
    });
    setPending(false);
    if (!result.ok) {
      setFormError(result.error.message);
      toast.error(result.error.message);
      return;
    }
    toast.success(`Quote ${resend ? "re-sent" : "sent"} to ${email || "the customer"}`);
    router.refresh();
  }

  async function handleCancel(id: string) {
    setPending(true);
    const result = await cancelQuote({ quoteId: id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast("Cancelled — the pay link stops working");
    router.refresh();
  }

  function handleCopyPayLink(payLink: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(payLink);
    }
    toast.success("Pay link copied");
  }

  return (
    <>
      <PageHeader
        title="Custom quotes"
        description="Private negotiated offers paid through the tokenised pay page. Coupons do not apply; amounts are tax-exclusive."
        actions={
          <Button size="sm" onClick={resetForm}>
            <PlusIcon aria-hidden /> New quote
          </Button>
        }
      />
      {loadError ? (
        <Banner tone="danger" title="Couldn't load quotes">
          {loadError}
        </Banner>
      ) : null}
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
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
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
                      <Link
                        href={`${customerHref}/${q.customer.id}`}
                        className="hover:text-accent-text"
                      >
                        {q.customer.name}
                      </Link>
                      <span className="block text-caption text-fg-muted">{q.customer.email}</span>
                    </TableCell>
                    <TableCell className="text-fg-muted">{q.offering ?? "—"}</TableCell>
                    <TableCell>
                      <MoneyCell value={q.amount} />
                    </TableCell>
                    <TableCell>{q.expiresAt ? formatDate(q.expiresAt) : "—"}</TableCell>
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
                            label: q.status === "draft" ? "Send" : "Resend",
                            disabled:
                              !["draft", "sent", "viewed", "expired"].includes(q.status) || pending,
                            onSelect: () =>
                              handleSend(q.id, q.customer.email, q.status !== "draft"),
                          },
                          {
                            label: "Copy pay link",
                            disabled: q.status === "draft",
                            onSelect: () => handleCopyPayLink(q.payLink),
                          },
                          { label: "Duplicate", disabled: true },
                          {
                            label: "Cancel",
                            destructive: true,
                            separatorBefore: true,
                            disabled:
                              ["paid", "cancelled", "rejected"].includes(q.status) || pending,
                            onSelect: () => handleCancel(q.id),
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
          ref={formRef}
          className="space-y-4 rounded-lg border border-border bg-surface p-5 lg:col-span-8"
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveClick();
          }}
        >
          <h2 className="text-h4">{selected ? selected.title : "New quote"}</h2>
          {selected ? (
            <Banner tone="neutral">
              Quotes can&apos;t be edited after creation — cancel this one and create a new quote
              instead.
            </Banner>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="q-customer" label="Customer" required>
              {selected ? (
                <Input
                  id="q-customer"
                  readOnly
                  value={`${selected.customer.name} · ${selected.customer.email}`}
                />
              ) : (
                <div className="space-y-2">
                  <Input
                    id="q-customer-search"
                    type="search"
                    placeholder="Search customers by name or email…"
                    aria-label="Search customers"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                  />
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger id="q-customer" className="w-full">
                      <SelectValue placeholder={searching ? "Searching…" : "Choose a customer"} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.length === 0 ? (
                        <div className="px-3 py-2 text-body-sm text-fg-muted">
                          No customers match
                        </div>
                      ) : null}
                      {customerId && !customers.some((c) => c.id === customerId) ? (
                        <SelectItem value={customerId}>Selected customer</SelectItem>
                      ) : null}
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} · {c.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </Field>
            <Field
              id="q-offering"
              label="Linked offering"
              optional
              hint="Link a product offering; picking one fills the price."
            >
              <Select
                value={selected ? (selected.offeringId ?? "none") : offeringId}
                onValueChange={(v) => {
                  setOfferingId(v);
                  const o = offerings.find((x) => x.id === v);
                  const amt = formRef.current?.elements.namedItem("amount");
                  if (o && amt instanceof HTMLInputElement) {
                    amt.value = (o.price.amountMinor / 100).toFixed(2);
                    setCurrency(o.price.currency);
                  }
                }}
                disabled={selected !== null}
              >
                <SelectTrigger id="q-offering" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (custom)</SelectItem>
                  {offerings.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="q-title" label="Title" required className="sm:col-span-2">
              <Input
                id="q-title"
                name="title"
                defaultValue={selected?.title ?? prefill?.title}
                key={`t-${selected?.id ?? "new"}`}
                required
                aria-required
                disabled={selected !== null}
              />
            </Field>
          </div>
          <RichTextField
            id="q-desc"
            name="description"
            label="Description (what's included)"
            defaultValue={selected?.description ?? prefill?.description}
            rows={4}
          />
          {selected === null ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line items (optional)</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setLines((l) => [...l, { d: "", q: "1", u: "" }])}
                >
                  <PlusIcon aria-hidden /> Add line
                </Button>
              </div>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_5rem_8rem_auto] gap-2">
                  <Input
                    aria-label={`Line ${i + 1} description`}
                    placeholder="Description"
                    value={l.d}
                    onChange={(e) =>
                      setLines((ls) =>
                        ls.map((x, j) => (j === i ? { ...x, d: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    aria-label={`Line ${i + 1} quantity`}
                    inputMode="numeric"
                    value={l.q}
                    onChange={(e) =>
                      setLines((ls) =>
                        ls.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    aria-label={`Line ${i + 1} unit price`}
                    inputMode="decimal"
                    placeholder="Unit price"
                    value={l.u}
                    onChange={(e) =>
                      setLines((ls) =>
                        ls.map((x, j) => (j === i ? { ...x, u: e.target.value } : x)),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove line ${i + 1}`}
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-4">
            <Field id="q-currency" label="Currency" required>
              <Select
                value={selected ? selected.amount.currency : currency}
                onValueChange={(v) => setCurrency(v as typeof currency)}
                disabled={selected !== null}
              >
                <SelectTrigger id="q-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["INR", "USD", "EUR", "GBP", "CAD"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              id="q-amount"
              label="Price (tax-exclusive)"
              required={lines.length === 0}
              hint={
                lines.length > 0
                  ? `From line items: ${(lineTotalMinor / 100).toFixed(2)}`
                  : undefined
              }
            >
              <Input
                id="q-amount"
                name="amount"
                inputMode="decimal"
                defaultValue={selected ? (selected.amount.amountMinor / 100).toFixed(2) : ""}
                key={`a-${selected?.id ?? "new"}`}
                className="text-right font-mono tnum"
                disabled={selected !== null || lines.length > 0}
              />
            </Field>
            <Field id="q-tax" label="Tax %" optional hint="Added on top, e.g. 18 for GST.">
              <Input
                id="q-tax"
                inputMode="decimal"
                value={selected ? String((selected.taxBps ?? 0) / 100) : taxPct}
                onChange={(e) => setTaxPct(e.target.value)}
                className="text-right font-mono tnum"
                disabled={selected !== null}
              />
            </Field>
            <Field id="q-expires" label="Valid until" required hint="Default +14 days.">
              <Input
                id="q-expires"
                name="expiresAt"
                type="date"
                defaultValue={selected?.expiresAt?.slice(0, 10) || defaultExpiresOn()}
                key={`e-${selected?.id ?? "new"}`}
                disabled={selected !== null}
              />
            </Field>
          </div>
          <Field id="q-note" label="Internal note" optional>
            <Textarea
              id="q-note"
              name="internalNote"
              rows={2}
              defaultValue={selected?.internalNote}
              key={`n-${selected?.id ?? "new"}`}
              disabled={selected !== null}
            />
          </Field>
          {formError ? (
            <Banner tone="danger" title="Couldn't complete that">
              {formError}
            </Banner>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" disabled={pending || selected !== null}>
              {pending ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="button"
              disabled={pending || selected !== null}
              onClick={() => void handleCreate(true)}
            >
              Save &amp; send
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
                  onClick={() => selected && handleCopyPayLink(selected.payLink)}
                >
                  <CopyIcon aria-hidden className="size-4" />
                </Button>
              </div>
              <p className="text-caption text-fg-muted">
                Requires login; only the invited customer can accept.
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                onClick={() =>
                  selected &&
                  handleSend(
                    selected.id,
                    selected.customer.email,
                    selected.status !== "draft",
                    selected.status === "expired" ? defaultExpiresOn() : undefined,
                  )
                }
                disabled={
                  !selected ||
                  !["draft", "sent", "viewed", "expired"].includes(selected.status) ||
                  pending
                }
              >
                {selected && selected.status !== "draft"
                  ? "Resend to customer"
                  : "Send to customer"}
              </Button>
              <Button
                variant="destructive"
                disabled={
                  !selected ||
                  ["paid", "cancelled", "rejected"].includes(selected.status) ||
                  pending
                }
                onClick={() => selected && handleCancel(selected.id)}
              >
                Cancel quote
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-2 text-h4">Email preview</h2>
            <div className="rounded-md border border-border bg-canvas p-3 text-body-sm">
              <p className="font-semibold">
                Your quote from <SiteName />
              </p>
              <p className="mt-1 text-fg-muted">
                {selected?.title ?? "Title"} · {selected ? money(selected.amount) : "₹0.00"}
                {selected?.taxApplies ? " + tax" : ""} · valid until{" "}
                {selected?.expiresAt ? formatDate(selected.expiresAt) : "—"}
              </p>
              <p className="mt-2 text-accent-text">Review and pay →</p>
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}
