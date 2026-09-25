"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupCard } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { allocateLargestRemainder, parseMinor } from "@/lib/money";
import { ApprovalGateNotice, Banner } from "../Banner";
import { SplitEditor, splitSummary, type SplitValue } from "../catalog/SplitEditor";
import { inr } from "../format";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import type { CustomerOption, OfferingOption } from "../types";

interface ProjectLine {
  id: number;
  description: string;
  qty: number;
  unit: string;
  split: SplitValue;
}

export interface ManualOrderFormProps {
  customers: CustomerOption[];
  offerings: OfferingOption[];
  partners: Array<{ id: string; name: string }>;
  approvers: string[];
  gstinConfigured: boolean;
  taxRateBps: number;
  isSuperAdmin: boolean;
  initialType?: "product" | "project";
}

/**
 * SCR-ADM-08 — manual / project order. Product orders pick offerings for a registered customer
 * and may record the payment now; project orders carry a `split_snapshot` per line (SplitEditor)
 * and cannot be invoiced or paid until the other admins approve the split (BR-05).
 */
export function ManualOrderForm({
  customers,
  offerings,
  partners,
  approvers,
  gstinConfigured,
  taxRateBps,
  isSuperAdmin,
  initialType = "project",
}: ManualOrderFormProps) {
  const [type, setType] = React.useState<"product" | "project">(initialType);
  const [productLines, setProductLines] = React.useState<Array<{ id: number; offeringId: string }>>(
    [{ id: 1, offeringId: offerings[0]?.id ?? "" }],
  );
  const [lines, setLines] = React.useState<ProjectLine[]>([
    {
      id: 1,
      description: "Discovery workshop",
      qty: 1,
      unit: "80,000.00",
      split: {
        companyCutBps: 2000,
        lines: partners.map((p) => ({ partnerId: p.id, partnerName: p.name, bps: 4000 })),
      },
    },
    {
      id: 2,
      description: "Portal build phase 1",
      qty: 1,
      unit: "3,20,000.00",
      split: {
        companyCutBps: 2000,
        lines: [
          { partnerId: partners[0]?.id ?? "", partnerName: partners[0]?.name ?? "", bps: 3000 },
          { partnerId: partners[1]?.id ?? "", partnerName: partners[1]?.name ?? "", bps: 5000 },
        ],
      },
    },
  ]);
  const [applyTax, setApplyTax] = React.useState(true);
  const [discount, setDiscount] = React.useState("0");
  const [recordPayment, setRecordPayment] = React.useState(false);
  const [received, setReceived] = React.useState("");

  const safeMinor = (s: string) => {
    try {
      return parseMinor(s, "INR");
    } catch {
      return 0;
    }
  };
  const subtotal =
    type === "product"
      ? productLines.reduce(
          (s, l) => s + (offerings.find((o) => o.id === l.offeringId)?.price.amountMinor ?? 0),
          0,
        )
      : lines.reduce((s, l) => s + l.qty * safeMinor(l.unit), 0);
  const discountMinor = Math.min(subtotal, safeMinor(discount));
  const taxable = subtotal - discountMinor;
  const taxMinor = applyTax && gstinConfigured ? Math.round((taxable * taxRateBps) / 10000) : 0;
  const total = taxable + taxMinor;
  const receivedMinor = safeMinor(received);
  const diff = recordPayment && received ? receivedMinor - total : 0;
  const splitsValid =
    type === "product" ||
    lines.every(
      (l) => l.split.companyCutBps + l.split.lines.reduce((s, x) => s + x.bps, 0) === 10000,
    );
  const owned = productLines.some((l) => offerings.find((o) => o.id === l.offeringId)?.owned);

  const ledgerPreview = React.useMemo(() => {
    if (taxable <= 0) return [];
    if (type === "product") {
      const parts = allocateLargestRemainder(taxable, [2000, 5000, 3000]);
      return [
        { party: "Company cut (20 %)", minor: parts[0] ?? 0 },
        { party: `${partners[0]?.name ?? "Partner A"} (50 %)`, minor: parts[1] ?? 0 },
        { party: `${partners[1]?.name ?? "Partner B"} (30 %)`, minor: parts[2] ?? 0 },
      ];
    }
    const totals = new Map<string, number>();
    for (const l of lines) {
      const lineTotal = l.qty * safeMinor(l.unit);
      const weights = [l.split.companyCutBps, ...l.split.lines.map((x) => x.bps)];
      if (weights.reduce((s, w) => s + w, 0) === 0 || lineTotal <= 0) continue;
      const parts = allocateLargestRemainder(lineTotal, weights);
      totals.set("Company", (totals.get("Company") ?? 0) + (parts[0] ?? 0));
      l.split.lines.forEach((x, i) =>
        totals.set(x.partnerName, (totals.get(x.partnerName) ?? 0) + (parts[i + 1] ?? 0)),
      );
    }
    return [...totals.entries()].map(([party, minor]) => ({ party, minor }));
  }, [type, taxable, lines, partners]);

  const setLine = (id: number, patch: Partial<ProjectLine>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <>
      <PageHeader
        title="New manual order"
        description="Same numbering and ledger as online orders. Project revenue posts using each line's approved split snapshot."
      />
      <div className="grid gap-6 lg:grid-cols-12">
        <form className="space-y-8 lg:col-span-8" onSubmit={(e) => e.preventDefault()}>
          <fieldset className="space-y-3">
            <legend className="text-h4">1. Type</legend>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as "product" | "project")}
              className="grid gap-3 sm:grid-cols-2"
            >
              <RadioGroupCard value="product">
                <span className="text-body font-semibold">Product order (offline sale)</span>
                <span className="text-caption text-fg-muted">
                  Offerings for a registered customer; entitlements need an account.
                </span>
              </RadioGroupCard>
              <RadioGroupCard value="project">
                <span className="text-body font-semibold">Project order (client invoice)</span>
                <span className="text-caption text-fg-muted">
                  Free-form lines, each with a split snapshot; approval-gated.
                </span>
              </RadioGroupCard>
            </RadioGroup>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-h4">2. Customer</legend>
            <Field
              id="mo-customer"
              label="Registered customer"
              required={type === "product"}
              hint={
                type === "product"
                  ? "Search by email. No account? Invite the customer first."
                  : "Or enter client details below."
              }
            >
              <Select defaultValue={customers[0]?.id}>
                <SelectTrigger id="mo-customer">
                  <SelectValue placeholder="Search by email" />
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
            {type === "project" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="mo-client" label="Client name" required>
                  <Input id="mo-client" defaultValue="Global Textiles Pvt Ltd" />
                </Field>
                <Field id="mo-client-email" label="Client email" required>
                  <Input
                    id="mo-client-email"
                    type="email"
                    defaultValue="accounts@globaltextiles.in"
                  />
                </Field>
                <Field id="mo-company" label="Company" optional>
                  <Input id="mo-company" />
                </Field>
                <Field id="mo-country" label="Country" required>
                  <Input id="mo-country" defaultValue="IN" />
                </Field>
                <Field id="mo-address" label="Billing address" className="sm:col-span-2">
                  <Textarea id="mo-address" rows={2} defaultValue="Plot 9, GIDC, Surat 395010" />
                </Field>
                <Field id="mo-gst" label="GST number" optional>
                  <Input id="mo-gst" className="font-mono" defaultValue="24AABCG1234H1Z5" />
                </Field>
              </div>
            ) : null}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-h4">3. Items</legend>
            {type === "product" ? (
              <div className="space-y-2">
                {productLines.map((l, i) => (
                  <div key={l.id} className="grid grid-cols-[1fr_80px_40px] items-end gap-2">
                    <Field id={`mo-off-${l.id}`} label={`Offering ${i + 1}`} required>
                      <Select
                        value={l.offeringId}
                        onValueChange={(v) =>
                          setProductLines((ls) =>
                            ls.map((x) => (x.id === l.id ? { ...x, offeringId: v } : x)),
                          )
                        }
                      >
                        <SelectTrigger id={`mo-off-${l.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {offerings.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.label} · {inr(o.price.amountMinor)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field id={`mo-qty-${l.id}`} label="Qty">
                      <Input
                        id={`mo-qty-${l.id}`}
                        readOnly
                        value="1"
                        className="text-right font-mono"
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-md"
                      aria-label={`Remove line ${i + 1}`}
                      onClick={() => setProductLines((ls) => ls.filter((x) => x.id !== l.id))}
                      disabled={productLines.length === 1}
                    >
                      <Trash2Icon aria-hidden className="size-4" />
                    </Button>
                  </div>
                ))}
                {owned ? (
                  <Banner tone="warning">
                    This customer already owns a one-time offering in this order (BR-10).
                  </Banner>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setProductLines((ls) => [
                      ...ls,
                      { id: Date.now(), offeringId: offerings[0]?.id ?? "" },
                    ])
                  }
                >
                  <PlusIcon aria-hidden /> Add line
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {lines.map((l, i) => (
                  <div
                    key={l.id}
                    className="space-y-3 rounded-lg border border-border bg-surface p-4"
                  >
                    <div className="grid grid-cols-[1fr_72px_160px_40px] items-end gap-2">
                      <Field id={`mo-desc-${l.id}`} label={`Line ${i + 1} description`} required>
                        <Input
                          id={`mo-desc-${l.id}`}
                          value={l.description}
                          onChange={(e) => setLine(l.id, { description: e.target.value })}
                        />
                      </Field>
                      <Field id={`mo-lqty-${l.id}`} label="Qty">
                        <Input
                          id={`mo-lqty-${l.id}`}
                          inputMode="numeric"
                          value={l.qty}
                          onChange={(e) =>
                            setLine(l.id, { qty: Number.parseInt(e.target.value || "1", 10) || 1 })
                          }
                          className="text-right font-mono"
                        />
                      </Field>
                      <Field id={`mo-unit-${l.id}`} label="Unit amount (INR)" required>
                        <Input
                          id={`mo-unit-${l.id}`}
                          inputMode="decimal"
                          value={l.unit}
                          onChange={(e) => setLine(l.id, { unit: e.target.value })}
                          className="text-right font-mono tnum"
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-md"
                        aria-label={`Remove line ${i + 1}`}
                        onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}
                        disabled={lines.length === 1}
                      >
                        <Trash2Icon aria-hidden className="size-4" />
                      </Button>
                    </div>
                    <details
                      className="group rounded-md border border-border bg-canvas p-3"
                      open={i === 0}
                    >
                      <summary className="cursor-pointer text-body-sm font-medium">
                        Split · {splitSummary(l.split)}
                      </summary>
                      <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap items-end gap-2">
                          <Field id={`mo-copy-${l.id}`} label="Copy from product">
                            <Select
                              onValueChange={() =>
                                setLine(l.id, {
                                  split: {
                                    companyCutBps: 2000,
                                    lines: [
                                      {
                                        partnerId: partners[0]?.id ?? "",
                                        partnerName: partners[0]?.name ?? "",
                                        bps: 5000,
                                      },
                                      {
                                        partnerId: partners[1]?.id ?? "",
                                        partnerName: partners[1]?.name ?? "",
                                        bps: 3000,
                                      },
                                    ],
                                  },
                                })
                              }
                            >
                              <SelectTrigger id={`mo-copy-${l.id}`} size="sm" className="w-56">
                                <SelectValue placeholder="Active ownership of…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="prod-1">FitDesk Pro (v2)</SelectItem>
                                <SelectItem value="prod-2">TradeFlow (v2)</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setLines((ls) => ls.map((x) => ({ ...x, split: l.split })))
                            }
                          >
                            Apply this split to all lines
                          </Button>
                        </div>
                        <SplitEditor
                          idPrefix={`mo-split-${l.id}`}
                          value={l.split}
                          onChange={(split) => setLine(l.id, { split })}
                          partners={partners}
                          compact
                        />
                      </div>
                    </details>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setLines((ls) => [
                      ...ls,
                      {
                        id: Date.now(),
                        description: "",
                        qty: 1,
                        unit: "0.00",
                        split: { companyCutBps: 10000, lines: [] },
                      },
                    ])
                  }
                >
                  <PlusIcon aria-hidden /> Add line
                </Button>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-h4">4. Pricing</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="mo-currency" label="Currency">
                <Input id="mo-currency" readOnly value="INR (base)" />
              </Field>
              <Field id="mo-discount" label="Discount amount">
                <Input
                  id="mo-discount"
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="text-right font-mono tnum"
                />
              </Field>
              <div className="space-y-1.5">
                <Label htmlFor="mo-tax">Apply tax</Label>
                <div className="flex h-10 items-center gap-2">
                  <Switch id="mo-tax" checked={applyTax} onCheckedChange={setApplyTax} />
                  <span className="text-caption text-fg-muted">
                    {gstinConfigured
                      ? `Effective rate ${taxRateBps / 100} %`
                      : "No GSTIN configured — tax will be 0"}
                  </span>
                </div>
              </div>
            </div>
            <Field id="mo-notes" label="Notes on invoice" optional>
              <Textarea id="mo-notes" rows={2} />
            </Field>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-h4">5. Payment</legend>
            {type === "project" ? (
              <Banner tone="neutral">
                Payment can be recorded on the order page once the split is approved.
              </Banner>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Switch
                    id="mo-record"
                    checked={recordPayment}
                    onCheckedChange={setRecordPayment}
                  />
                  <Label htmlFor="mo-record">Record payment now</Label>
                </div>
                {recordPayment ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="mo-method" label="Method" required>
                      <Select defaultValue="manual_bank">
                        <SelectTrigger id="mo-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual_bank">Bank transfer</SelectItem>
                          <SelectItem value="manual_upi">UPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field id="mo-received" label="Amount received" required>
                      <Input
                        id="mo-received"
                        inputMode="decimal"
                        value={received}
                        onChange={(e) => setReceived(e.target.value)}
                        className="text-right font-mono tnum"
                      />
                    </Field>
                    <Field id="mo-ref" label="Reference" required>
                      <Input id="mo-ref" className="font-mono" />
                    </Field>
                    <Field id="mo-paid-on" label="Paid on" required>
                      <Input id="mo-paid-on" type="date" defaultValue="2026-09-25" />
                    </Field>
                    {received ? (
                      <p role="status" aria-live="polite" className="text-body-sm sm:col-span-2">
                        {diff < 0 ? (
                          <span className="text-warning">Shortfall {inr(-diff)} → bank charge</span>
                        ) : diff > 0 ? (
                          <span className="text-info">Overpaid {inr(diff)} → customer credit</span>
                        ) : (
                          "Received matches the total."
                        )}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-body-sm text-fg-muted">
                    Left empty, the order is created Pending payment and instructions are emailed to
                    the customer.
                  </p>
                )}
              </>
            )}
          </fieldset>
        </form>

        <aside className="space-y-4 lg:col-span-4">
          <div className="sticky top-[calc(var(--admin-top)+4.5rem)] space-y-4">
            <section
              aria-label="Summary"
              className="rounded-lg border border-border bg-surface p-4"
            >
              <h2 className="mb-3 text-h4">Summary</h2>
              <dl className="space-y-1.5 text-body-sm" aria-live="polite">
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Lines</dt>
                  <dd className="font-mono tnum">{inr(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Discount</dt>
                  <dd className="font-mono tnum">−{inr(discountMinor)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Tax</dt>
                  <dd className="font-mono tnum">{inr(taxMinor)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 text-body font-semibold">
                  <dt>Total</dt>
                  <dd className="font-mono tnum">{inr(total)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-caption text-fg-muted">
                {type === "project"
                  ? "Invoice will be issued after the split is approved and the payment is confirmed."
                  : "Invoice CK/2026-27/nnnn will be issued when the payment is confirmed."}
              </p>
            </section>
            {isSuperAdmin ? (
              <section
                aria-label="Ledger preview"
                className="rounded-lg border border-border bg-surface p-4"
              >
                <h2 className="mb-3 text-h4">Ledger preview</h2>
                {ledgerPreview.length === 0 ? (
                  <p className="text-body-sm text-fg-muted">Add lines to preview the split.</p>
                ) : (
                  <ul className="space-y-1 text-body-sm">
                    {ledgerPreview.map((p) => (
                      <li key={p.party} className="flex justify-between">
                        <span className="text-fg-muted">{p.party}</span>
                        <span className="font-mono tnum">{inr(p.minor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-caption text-fg-subtle">
                  Largest-remainder rounding; lines always sum exactly.
                </p>
              </section>
            ) : null}
            {type === "project" ? (
              <ApprovalGateNotice approvers={approvers} what="Creating a project order" />
            ) : null}
            {!splitsValid ? (
              <Banner tone="danger">Every project line needs a split that sums to 100 %.</Banner>
            ) : null}
            <div className="flex flex-col gap-2">
              <Button
                disabled={!splitsValid || total <= 0}
                onClick={() =>
                  toast.success(
                    type === "project"
                      ? `Order created · split approval requested from ${approvers[0]}`
                      : recordPayment
                        ? "Order created and confirmed · invoice CK/2026-27/0007"
                        : "Order created · instructions emailed",
                  )
                }
              >
                {type === "project"
                  ? "Create & request split approval"
                  : recordPayment
                    ? "Create & confirm"
                    : "Create order"}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
