"use client";

import * as React from "react";
import { CopyIcon, PlusIcon, TicketPercentIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { formatDate, money } from "../format";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { CouponRow } from "../types";

/** SCR-ADM-32 — coupons table with state chips and the editor sheet + live preview line. */
export function CouponsList({
  coupons,
  products,
  ordersHref,
}: {
  coupons: CouponRow[];
  products: string[];
  ordersHref: string;
}) {
  const [state, setState] = React.useState<CouponRow["state"] | null>(null);
  const [editing, setEditing] = React.useState<CouponRow | "new" | null>(null);
  const [kind, setKind] = React.useState<"percent" | "fixed">("percent");
  const [value, setValue] = React.useState("10");
  const [endsAt, setEndsAt] = React.useState("2026-10-31");
  const [max, setMax] = React.useState("50");
  const rows = coupons
    .filter((c) => (state ? c.state === state : true))
    .sort((a, b) => (a.state === "active" ? -1 : b.state === "active" ? 1 : 0));

  const openEditor = (c: CouponRow | "new") => {
    setEditing(c);
    if (c !== "new") {
      setKind(c.kind);
      setValue(
        c.kind === "percent"
          ? String((c.valueBps ?? 0) / 100)
          : String((c.amount?.amountMinor ?? 0) / 100),
      );
      setEndsAt(c.endsAt ?? "");
      setMax(c.max ? String(c.max) : "");
    } else {
      setKind("percent");
      setValue("10");
      setEndsAt("");
      setMax("");
    }
  };

  const preview = `${kind === "percent" ? `${value || 0}% off` : `₹${value || 0} off`} any product${endsAt ? `, until ${formatDate(endsAt)}` : ""}${max ? `, max ${max} uses` : ""}`;

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Codes are case-insensitive. Redemptions count only on paid orders."
        actions={
          <Button size="sm" onClick={() => openEditor("new")}>
            <PlusIcon aria-hidden /> New coupon
          </Button>
        }
      />
      <FilterChips
        label="Filter by state"
        chips={STATUS_ENUMS["coupons.state"].map((s) => ({
          value: s,
          label: s.charAt(0).toUpperCase() + s.slice(1),
          count: coupons.filter((c) => c.state === s).length,
        }))}
        value={state}
        onChange={setState}
      />
      <div className="mt-4">
        <DataToolbar searchId="coupons-search" searchPlaceholder="Search code…" />
        {rows.length === 0 ? (
          <EmptyState icon={TicketPercentIcon} title="No coupons — create one for launch" />
        ) : (
          <div className="rounded-lg border border-border bg-surface">
            <Table>
              <TableCaption className="sr-only">Coupons</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type & value</TableHead>
                  <TableHead>Valid</TableHead>
                  <TableHead className="text-right">Redemptions</TableHead>
                  <TableHead>Restrictions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-mono">
                        {c.code}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Copy code ${c.code}`}
                          onClick={() => toast.success(`Copied ${c.code}`)}
                        >
                          <CopyIcon aria-hidden className="size-3.5" />
                        </Button>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <StatusBadge kind="coupons.kind" value={c.kind} size="sm" />
                        {c.kind === "percent"
                          ? `${(c.valueBps ?? 0) / 100}%`
                          : c.amount
                            ? money(c.amount)
                            : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-fg-muted">
                      {formatDate(c.startsAt)} – {c.endsAt ? formatDate(c.endsAt) : "no end"}
                    </TableCell>
                    <TableCell className="text-right font-mono tnum">
                      {c.used} / {c.max ?? "∞"}
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {c.products.map((p) => (
                          <Badge key={p} tone="neutral" size="sm">
                            {p}
                          </Badge>
                        ))}
                        {c.firstPurchaseOnly ? (
                          <Badge tone="info" size="sm">
                            First purchase
                          </Badge>
                        ) : null}
                        {c.products.length === 0 && !c.firstPurchaseOnly ? (
                          <span className="text-fg-subtle">Any product</span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="coupons.state" value={c.state} />
                    </TableCell>
                    <TableCell className="text-fg-muted">{c.createdBy}</TableCell>
                    <TableCell>
                      <RowActions
                        label={`Actions for ${c.code}`}
                        actions={[
                          { label: "Edit", onSelect: () => openEditor(c) },
                          {
                            label: c.state === "inactive" ? "Activate" : "Deactivate",
                            onSelect: () =>
                              toast.success(
                                `${c.code} ${c.state === "inactive" ? "activated" : "deactivated — orders already using it are unaffected"}`,
                              ),
                          },
                          { label: "Duplicate", onSelect: () => openEditor("new") },
                          { label: "View orders", href: ordersHref, separatorBefore: true },
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

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="overflow-y-auto lg:w-[640px] tv:w-[760px]">
          <SheetHeader>
            <SheetTitle>
              {editing === "new" || editing === null ? "New coupon" : `Edit ${editing.code}`}
            </SheetTitle>
            <SheetDescription>
              Percentage ≤ 100; fixed amounts are in the base currency (INR).
            </SheetDescription>
          </SheetHeader>
          <form className="space-y-5 px-4" onSubmit={(e) => e.preventDefault()}>
            <Field
              id="cp-code"
              label="Code"
              required
              hint="Uppercase, 4–20 characters; uniqueness is checked on save."
            >
              <div className="flex gap-2">
                <Input
                  id="cp-code"
                  className="font-mono uppercase"
                  defaultValue={editing && editing !== "new" ? editing.code : ""}
                  required
                  aria-required
                />
                <Button type="button" variant="secondary">
                  Generate
                </Button>
              </div>
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-body-sm font-semibold">Kind</legend>
              <RadioGroup
                value={kind}
                onValueChange={(v) => setKind(v as "percent" | "fixed")}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="cp-kind-pct" value="percent" />
                  <Label htmlFor="cp-kind-pct">Percentage</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="cp-kind-fixed" value="fixed" />
                  <Label htmlFor="cp-kind-fixed">Fixed amount (INR)</Label>
                </div>
              </RadioGroup>
            </fieldset>
            <Field
              id="cp-value"
              label={kind === "percent" ? "Percent off" : "Amount off (₹)"}
              required
            >
              <Input
                id="cp-value"
                inputMode="decimal"
                className="w-40 text-right font-mono tnum"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="cp-starts" label="Starts at">
                <Input
                  id="cp-starts"
                  type="date"
                  defaultValue={editing && editing !== "new" ? editing.startsAt : "2026-09-25"}
                />
              </Field>
              <Field id="cp-ends" label="Ends at" optional>
                <Input
                  id="cp-ends"
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </Field>
            </div>
            <Field id="cp-max" label="Max redemptions" optional hint="Blank = unlimited.">
              <Input
                id="cp-max"
                inputMode="numeric"
                className="w-40 text-right font-mono"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Switch
                id="cp-first"
                defaultChecked={editing !== null && editing !== "new" && editing.firstPurchaseOnly}
              />
              <Label htmlFor="cp-first">First purchase only</Label>
            </div>
            <Field
              id="cp-products"
              label="Restrict to products"
              optional
              hint="Blank = all products."
            >
              <div className="flex flex-wrap gap-2">
                {products.map((p) => (
                  <label
                    key={p}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-body-sm"
                  >
                    <input
                      type="checkbox"
                      className="accent-accent"
                      defaultChecked={
                        editing !== null && editing !== "new" && editing.products.includes(p)
                      }
                    />{" "}
                    {p}
                  </label>
                ))}
              </div>
            </Field>
            <div className="flex items-center gap-2">
              <Switch id="cp-active" defaultChecked />
              <Label htmlFor="cp-active">Active</Label>
            </div>
            <Field id="cp-note" label="Internal note" optional>
              <Textarea id="cp-note" rows={2} />
            </Field>
            <p
              role="status"
              aria-live="polite"
              className="rounded-md bg-elevated px-3 py-2 text-body-sm"
            >
              Preview: <span className="font-medium">{preview}</span>
            </p>
          </form>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success("Coupon saved");
                setEditing(null);
              }}
            >
              Save coupon
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
