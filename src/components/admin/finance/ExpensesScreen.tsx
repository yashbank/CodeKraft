"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon, PaperclipIcon, PlusIcon, ReceiptIcon, UploadIcon } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { allocateLargestRemainder, parseMinor, type Currency } from "@/lib/money";
import { recordExpense } from "@/modules/finance/admin-mutations";
import { Banner } from "../Banner";
import { DataToolbar, ToolbarField } from "../DataToolbar";
import { EmptyState } from "../EmptyState";
import { formatDate, inr } from "../format";
import { MoneyCell } from "../MoneyCell";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import { RowActions } from "../RowActions";
import { StatTile } from "../StatTile";
import type { ExpenseRow } from "../types";

const CATEGORIES = [
  "Hosting",
  "Domains",
  "Licences/tools",
  "Contractors",
  "Marketing",
  "Fees",
  "Other",
];

export interface ExpenseProductOption {
  id: string;
  name: string;
}

export interface ExpensesScreenProps {
  expenses: ExpenseRow[];
  products: ExpenseProductOption[];
  ledgerHref: string;
  adjustmentsHref: string;
  productHref: string;
}

/** SCR-ADM-20 — expenses list (immutable; reversed via adjustments) and the Record-expense sheet with the split preview. */
export function ExpensesScreen({
  expenses,
  products,
  ledgerHref,
  adjustmentsHref,
  productHref,
}: ExpensesScreenProps) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [open, setOpen] = React.useState(false);
  const [product, setProduct] = React.useState<string>("company");
  const [category, setCategory] = React.useState("Hosting");
  const [currency, setCurrency] = React.useState<Currency>("INR");
  const [shared, setShared] = React.useState(true);
  const [amount, setAmount] = React.useState("5,000.00");
  const [submitting, setSubmitting] = React.useState(false);
  const amountMinor = (() => {
    try {
      return parseMinor(amount || "0", currency);
    } catch {
      return 0;
    }
  })();
  const preview =
    product !== "company" && shared && amountMinor > 0
      ? allocateLargestRemainder(amountMinor, [5000, 3000])
      : null;

  async function handleRecord() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const description = String(fd.get("description") ?? "").trim();
    const incurredOn = String(fd.get("incurredOn") ?? "");
    const note = String(fd.get("note") ?? "").trim();
    if (amountMinor <= 0) {
      toast.error("Enter an amount greater than 0.");
      return;
    }
    if (!incurredOn) {
      toast.error("Pick the date the expense was incurred.");
      return;
    }
    const payload: Record<string, unknown> = {
      category,
      description: description || note || undefined,
      amountMinor,
      currency,
      incurredOn,
      sharedBySplit: product !== "company" && shared,
    };
    if (product !== "company") payload.productId = product;

    setSubmitting(true);
    const result = await recordExpense(payload);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Expense recorded");
    setOpen(false);
    router.refresh();
  }
  const total = expenses.reduce((s, e) => s + e.amountInr, 0);
  const byProduct = [
    ...expenses
      .reduce(
        (m, e) => m.set(e.product ?? "Company", (m.get(e.product ?? "Company") ?? 0) + e.amountInr),
        new Map<string, number>(),
      )
      .entries(),
  ].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Record costs against products (shared by that product's split) or the company so reports show profit, not just revenue (D-514)."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast("Export queued")}>
              <DownloadIcon aria-hidden /> Export CSV
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <PlusIcon aria-hidden /> Record expense
            </Button>
          </>
        }
      />
      <Banner tone="neutral" className="mb-4">
        Expenses post to the ledger immediately and can&rsquo;t be edited. Mistakes are fixed with
        an adjustment.
      </Banner>
      <DataToolbar
        searchId="exp-search"
        searchPlaceholder="Description…"
        filters={
          <>
            <ToolbarField id="exp-from" label="From">
              <Input id="exp-from" type="date" defaultValue="2026-06-27" className="h-8 w-40" />
            </ToolbarField>
            <ToolbarField id="exp-to" label="To">
              <Input id="exp-to" type="date" defaultValue="2026-09-25" className="h-8 w-40" />
            </ToolbarField>
            <ToolbarField id="exp-product" label="Product">
              <Select>
                <SelectTrigger id="exp-product" size="sm" className="w-44">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company (no product)</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ToolbarField>
            <ToolbarField id="exp-category" label="Category">
              <Select>
                <SelectTrigger id="exp-category" size="sm" className="w-40">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ToolbarField>
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile label="Total (range)" value={inr(total)} />
        <StatTile
          label="By product · top 3"
          value={
            <ul className="text-body-sm font-normal">
              {byProduct
                .filter(([k]) => k !== "Company")
                .slice(0, 3)
                .map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span>{k}</span>
                    <span className="font-mono tnum">{inr(v)}</span>
                  </li>
                ))}
            </ul>
          }
        />
        <StatTile
          label="Company-only"
          value={inr(byProduct.find(([k]) => k === "Company")?.[1] ?? 0)}
        />
      </div>
      {expenses.length === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title="No expenses recorded"
          body="Add hosting, tools or contractor costs to see profit by product."
        />
      ) : (
        <div className="rounded-lg border border-border bg-surface">
          <Table>
            <TableCaption className="sr-only">Expenses</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Shared by split</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Recorded by</TableHead>
                <TableHead>Ledger</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{formatDate(e.at)}</TableCell>
                  <TableCell className="font-medium">{e.description}</TableCell>
                  <TableCell className="text-fg-muted">{e.category}</TableCell>
                  <TableCell>
                    {e.product ? (
                      <Link href={productHref} className="hover:text-accent-text">
                        {e.product}
                      </Link>
                    ) : (
                      <span className="text-fg-muted">Company</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <MoneyCell value={e.amount} inrEquivalent={e.amountInr} />
                  </TableCell>
                  <TableCell>{e.sharedBySplit ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    {e.receipt ? (
                      <a
                        href="#receipt"
                        className="inline-flex items-center gap-1 text-accent-text hover:underline"
                        aria-label={`Receipt ${e.receipt}`}
                      >
                        <PaperclipIcon aria-hidden className="size-3.5" />
                        {e.receipt}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-fg-muted">{e.recordedBy}</TableCell>
                  <TableCell>
                    <Link href={ledgerHref} className="font-mono text-accent-text hover:underline">
                      {e.ledgerSeq}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <RowActions
                      label={`Actions for ${e.description}`}
                      actions={[
                        { label: "View receipt", disabled: !e.receipt },
                        {
                          label: "Copy seq",
                          onSelect: () => toast.success(`Copied ${e.ledgerSeq}`),
                        },
                        {
                          label: "Reverse via adjustment",
                          href: adjustmentsHref,
                          separatorBefore: true,
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto lg:w-[560px]">
          <SheetHeader>
            <SheetTitle>Record expense</SheetTitle>
            <SheetDescription>
              Posts an immutable expense entry. Product expenses are shared by the product&rsquo;s
              active ownership unless company-only.
            </SheetDescription>
          </SheetHeader>
          <form
            ref={formRef}
            className="space-y-4 px-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleRecord();
            }}
          >
            <Field id="ex-desc" label="Description" required>
              <Input id="ex-desc" name="description" required aria-required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ex-cat" label="Category" required>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="ex-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="ex-date" label="Incurred on" required>
                <Input id="ex-date" name="incurredOn" type="date" defaultValue="2026-09-25" />
              </Field>
              <Field id="ex-amount" label="Amount" required>
                <Input
                  id="ex-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-right font-mono tnum"
                />
              </Field>
              <Field
                id="ex-currency"
                label="Currency"
                hint="Converted to INR on the ledger at posting."
              >
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger id="ex-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR (base)</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field id="ex-product" label="Product" optional>
              <Select value={product} onValueChange={setProduct}>
                <SelectTrigger id="ex-product">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company (no product)</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-start gap-3">
              <Switch
                id="ex-shared"
                checked={shared && product !== "company"}
                disabled={product === "company"}
                onCheckedChange={setShared}
              />
              <div>
                <Label htmlFor="ex-shared">Share by product split</Label>
                <p className="text-caption text-fg-muted">
                  Deducts each partner&rsquo;s share from their balance using the product&rsquo;s
                  active ownership.
                </p>
              </div>
            </div>
            {preview ? (
              <p
                role="status"
                aria-live="polite"
                className="rounded-md bg-elevated px-3 py-2 text-body-sm"
              >
                Estimated split (illustrative 50/30 example) − partner A {inr(preview[0] ?? 0)} ·
                partner B {inr(preview[1] ?? 0)}
              </p>
            ) : null}
            <div className="rounded-lg border-2 border-dashed border-border-strong p-4 text-center text-body-sm text-fg-muted">
              <UploadIcon aria-hidden className="mx-auto mb-1 size-6" />
              Receipt · PDF or image ≤ 10 MB
              <p className="mt-1 text-caption text-fg-subtle">
                Upload isn&rsquo;t wired yet — the expense saves without a receipt attached.
              </p>
            </div>
            <Field id="ex-note" label="Note" optional>
              <Textarea id="ex-note" name="note" rows={2} />
            </Field>
          </form>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              disabled={submitting}
              onClick={() => {
                void handleRecord();
              }}
            >
              Record
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
