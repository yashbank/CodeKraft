"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { parseMinor } from "@/lib/money";
import { cn } from "@/components/ui/_utils";
import { money } from "../format";
import { Field } from "../RichTextField";
import type { MoneyLike } from "../types";

export interface ConfirmPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  due: MoneyLike;
  customerReference?: string;
  /** Project orders cannot be confirmed until the split is applied. */
  blockedReason?: string;
  onConfirm?: (result: { receivedMinor: number; reference: string; note: string }) => void;
}

/**
 * Confirm-payment dialog shared by SCR-ADM-06 (inline) and SCR-ADM-07 (docs/07 §4.11 financial
 * confirmation). Live recap: due, received, shortfall → bank charge, or overpayment → customer
 * credit (never allocated to partners). The primary enables only after the verification checkbox.
 */
export function ConfirmPaymentDialog({
  open,
  onOpenChange,
  orderNumber,
  due,
  customerReference,
  blockedReason,
  onConfirm,
}: ConfirmPaymentDialogProps) {
  const [received, setReceived] = React.useState(() => (due.amountMinor / 100).toFixed(2));
  const [reference, setReference] = React.useState(customerReference ?? "");
  const [note, setNote] = React.useState("");
  const [verified, setVerified] = React.useState(false);
  const receivedMinor = React.useMemo(() => {
    try {
      return parseMinor(received, due.currency);
    } catch {
      return Number.NaN;
    }
  }, [received, due.currency]);
  const valid = Number.isFinite(receivedMinor) && receivedMinor > 0;
  const diff = valid ? receivedMinor - due.amountMinor : 0;
  const shortfall = diff < 0 ? { amountMinor: -diff, currency: due.currency } : null;
  const credit = diff > 0 ? { amountMinor: diff, currency: due.currency } : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="max-h-[calc(100svh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm payment · {orderNumber}</DialogTitle>
          <DialogDescription>
            Amount received less than due is recorded as a bank charge on this order and deducted
            before the split (D-516). Over-receipt is held as customer credit and never allocated to
            partners.
          </DialogDescription>
        </DialogHeader>
        {blockedReason ? (
          <p
            role="alert"
            className="rounded-md border-l-4 border-warning bg-warning-soft px-3 py-2 text-body-sm text-warning"
          >
            {blockedReason}
          </p>
        ) : null}
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
          <Field
            id="cp-received"
            label={`Amount received (${due.currency})`}
            required
            error={!valid ? "Enter the amount that reached the account." : undefined}
          >
            <Input
              id="cp-received"
              inputMode="decimal"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              aria-invalid={!valid}
              className="text-right font-mono tnum"
            />
          </Field>
          <Field id="cp-received-on" label="Received on" required>
            <Input
              id="cp-received-on"
              type="date"
              defaultValue="2026-09-25"
              required
              aria-required
            />
          </Field>
          <Field id="cp-ref" label="Reference (UTR / NEFT)" required className="sm:col-span-2">
            <Input
              id="cp-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required
              aria-required
              className="font-mono"
            />
          </Field>
          <Field
            id="cp-note"
            label="Note"
            optional
            className="sm:col-span-2"
            hint={credit ? "Overpayments require a note." : undefined}
          >
            <Textarea
              id="cp-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </form>
        <table className="w-full text-body-sm">
          <caption className="sr-only">Payment recap</caption>
          <tbody>
            <tr className="border-b border-border">
              <th scope="row" className="py-1.5 text-left font-medium text-fg-muted">
                Due
              </th>
              <td className="py-1.5 text-right font-mono tnum">{money(due)}</td>
            </tr>
            <tr className="border-b border-border">
              <th scope="row" className="py-1.5 text-left font-medium text-fg-muted">
                Received
              </th>
              <td className="py-1.5 text-right font-mono tnum">
                {valid ? money({ amountMinor: receivedMinor, currency: due.currency }) : "—"}
              </td>
            </tr>
            <tr>
              <th scope="row" className="py-1.5 text-left font-medium text-fg-muted">
                {shortfall ? "Shortfall" : credit ? "Overpaid" : "Difference"}
              </th>
              <td
                aria-live="polite"
                className={cn(
                  "py-1.5 text-right font-mono tnum",
                  shortfall && "text-warning",
                  credit && "text-info",
                )}
              >
                {shortfall
                  ? `${money(shortfall)} → recorded as bank charge`
                  : credit
                    ? `${money(credit)} → customer credit, not allocated`
                    : "None"}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-start gap-2">
          <Checkbox
            id="cp-verified"
            checked={verified}
            onCheckedChange={(v) => setVerified(v === true)}
          />
          <Label htmlFor="cp-verified" className="leading-snug">
            I have verified this transfer in the bank / UPI statement
          </Label>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            disabled={
              !verified ||
              !valid ||
              reference.trim() === "" ||
              (credit !== null && note.trim() === "") ||
              Boolean(blockedReason)
            }
            onClick={() => {
              onConfirm?.({ receivedMinor, reference, note });
              onOpenChange(false);
            }}
          >
            Confirm and mark Paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
