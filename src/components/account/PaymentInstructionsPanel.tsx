"use client";

import { QrCodeIcon, SmartphoneIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, type Money } from "@/lib/money";
import { CopyButton } from "./CopyButton";
import type { PaymentInstructions, PaymentProvider } from "./types";

/**
 * QR / payment instruction panel (docs/08 §6.15, D-501, D-516): UPI tab with a 224px QR on a white
 * tile (always white for scanner reliability — the tile uses the print-white token), VPA + copy,
 * amount, order number, "Open in UPI app" on phones; bank tab with copyable rows.
 * `qrDataUrl` is the encoded QR (absent in previews / on generation failure → text fallback).
 */
export function PaymentInstructionsPanel({
  instructions,
  methods,
  method,
  onMethodChange,
  amount,
  orderNumber,
  qrDataUrl,
}: {
  instructions: PaymentInstructions;
  methods: PaymentProvider[];
  method: PaymentProvider;
  onMethodChange?: (m: PaymentProvider) => void;
  amount: Money;
  orderNumber: string;
  qrDataUrl?: string;
}) {
  const upiLink = instructions.upi
    ? `upi://pay?pa=${encodeURIComponent(instructions.upi.vpa)}&pn=${encodeURIComponent(instructions.upi.payeeName)}&am=${(amount.amountMinor / 100).toFixed(2)}&cu=${amount.currency}&tn=${encodeURIComponent(orderNumber)}`
    : undefined;

  return (
    <Tabs value={method} onValueChange={(v) => onMethodChange?.(v as PaymentProvider)}>
      {methods.length > 1 ? (
        <TabsList className="mb-4 w-full sm:w-auto">
          {methods.includes("manual_upi") ? (
            <TabsTrigger value="manual_upi">UPI</TabsTrigger>
          ) : null}
          {methods.includes("manual_bank") ? (
            <TabsTrigger value="manual_bank">Bank transfer</TabsTrigger>
          ) : null}
        </TabsList>
      ) : null}

      {instructions.upi ? (
        <TabsContent value="manual_upi" className="space-y-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div
              className="flex size-[256px] shrink-0 items-center justify-center rounded-md bg-[var(--ck-p-paper-50)] p-4 shadow-1"
              aria-label={
                qrDataUrl
                  ? `UPI QR code for ${format(amount)}, order ${orderNumber}`
                  : "QR code placeholder"
              }
              role="img"
            >
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL, sized fixed
                <img src={qrDataUrl} alt="" width={224} height={224} />
              ) : (
                <QrCodeIcon aria-hidden className="size-40 text-[var(--ck-p-ink-900)]" />
              )}
            </div>
            <dl className="w-full space-y-3 text-body-sm">
              <div>
                <dt className="text-caption text-fg-muted">Pay to (VPA)</dt>
                <dd className="flex items-center gap-1 font-mono text-fg">
                  {instructions.upi.vpa}
                  <CopyButton value={instructions.upi.vpa} label="VPA" />
                </dd>
              </div>
              <div>
                <dt className="text-caption text-fg-muted">Amount</dt>
                <dd className="font-mono text-price text-fg">{format(amount)}</dd>
              </div>
              <div>
                <dt className="text-caption text-fg-muted">Payment note</dt>
                <dd className="flex items-center gap-1 font-mono text-fg">
                  {orderNumber}
                  <CopyButton value={orderNumber} label="Order number" />
                </dd>
              </div>
              {upiLink ? (
                <Button variant="secondary" className="w-full sm:hidden" asChild>
                  <a href={upiLink}>
                    <SmartphoneIcon aria-hidden /> Open in UPI app
                  </a>
                </Button>
              ) : null}
            </dl>
          </div>
          <p className="text-caption text-fg-muted">
            The QR encodes the exact amount and the order number. Use{" "}
            <span className="font-mono">{orderNumber}</span> as the payment note if you enter it by
            hand.
          </p>
        </TabsContent>
      ) : null}

      {instructions.bank ? (
        <TabsContent value="manual_bank" className="space-y-4">
          <dl className="divide-y divide-border rounded-lg border border-border">
            <BankRow label="Account name" value={instructions.bank.accountName} />
            <BankRow label="Account number" value={instructions.bank.accountNumber} copy />
            <BankRow label="IFSC" value={instructions.bank.ifsc} copy />
            <BankRow label="Bank" value={instructions.bank.bankName} />
            {instructions.bank.swift ? (
              <BankRow label="SWIFT" value={instructions.bank.swift} copy />
            ) : null}
            <BankRow
              label="Amount"
              value={format(amount)}
              copy
              copyValue={(amount.amountMinor / 100).toFixed(2)}
            />
            <BankRow label="Reference to quote" value={orderNumber} copy />
          </dl>
          <p className="text-caption text-warning">
            Transfers can take up to 1 working day to reach us.
          </p>
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

function BankRow({
  label,
  value,
  copy = false,
  copyValue,
}: {
  label: string;
  value: string;
  copy?: boolean;
  copyValue?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <dt className="w-32 shrink-0 text-caption text-fg-muted">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center justify-between gap-2 font-mono text-body-sm text-fg">
        <span className="truncate">{value}</span>
        {copy ? <CopyButton value={copyValue ?? value} label={label} /> : null}
      </dd>
    </div>
  );
}
