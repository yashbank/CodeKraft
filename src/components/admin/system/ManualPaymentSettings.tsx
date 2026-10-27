"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateSettings } from "@/modules/settings/admin-mutations";
import { Banner } from "../Banner";
import { Field } from "../RichTextField";
import type { SettingsData } from "../types";

/** Keep in step with `UPI_QR_IMAGE_MAX_CHARS` (base64 inflates ~4/3). */
const QR_MAX_BYTES = 220 * 1024;
const QR_MIMES = ["image/png", "image/jpeg", "image/webp"];

type Payments = SettingsData["payments"];

/** `patch.upiVpa` / `patch.bankDetails.ifsc` → input id. */
const FIELD_IDS: Record<string, string> = {
  "patch.upiVpa": "st-vpa",
  "patch.upiPayeeName": "st-payee",
  "patch.upiQrImage": "st-qr",
  "patch.bankDetails": "st-acct-name",
  "patch.bankDetails.accountName": "st-acct-name",
  "patch.bankDetails.accountNumber": "st-acct-no",
  "patch.bankDetails.ifsc": "st-ifsc",
  "patch.bankDetails.bankName": "st-bank-name",
  "patch.bankDetails.branch": "st-branch",
  "patch.bankDetails.swift": "st-swift",
  upiVpa: "st-vpa",
  bankDetails: "st-acct-name",
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
}

/**
 * R8-01 — the UPI + bank transfer details customers see at checkout and on their order page.
 * Saved with `updateSettings` (API-ADM-10, audited). A method switched on without its details is
 * refused by the server, and checkout hides any method whose details are missing — customers
 * never see placeholder payee details.
 */
export function ManualPaymentSettings({ payments: p, ro }: { payments: Payments; ro: boolean }) {
  const router = useRouter();
  const [upi, setUpi] = React.useState(p.upiEnabled);
  const [vpa, setVpa] = React.useState(p.vpa);
  const [payee, setPayee] = React.useState(p.payeeName);
  const [qr, setQr] = React.useState<string | null>(p.qrImage);
  const [bank, setBank] = React.useState(p.bankEnabled);
  const [acctName, setAcctName] = React.useState(p.accountName);
  const [acctNo, setAcctNo] = React.useState(p.accountNumber);
  const [ifsc, setIfsc] = React.useState(p.ifsc);
  const [bankName, setBankName] = React.useState(p.bankName);
  const [branch, setBranch] = React.useState(p.branch ?? "");
  const [swift, setSwift] = React.useState(p.swift ?? "");
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const fileRef = React.useRef<HTMLInputElement>(null);

  const upiReady = vpa.trim().length > 0;
  const bankReady = [acctName, acctNo, ifsc, bankName].every((v) => v.trim().length > 0);

  async function onPickQr(file: File | undefined) {
    if (!file) return;
    if (!QR_MIMES.includes(file.type)) {
      setErrors((e) => ({ ...e, "st-qr": "Upload a PNG, JPEG or WebP image." }));
      return;
    }
    if (file.size > QR_MAX_BYTES) {
      setErrors((e) => ({ ...e, "st-qr": "Image is too large — keep it under 220 KB." }));
      return;
    }
    try {
      setQr(await readAsDataUrl(file));
      setErrors(({ "st-qr": _drop, ...rest }) => rest);
    } catch (err) {
      setErrors((e) => ({ ...e, "st-qr": (err as Error).message }));
    }
  }

  async function save() {
    const anyBank = [acctName, acctNo, ifsc, bankName, branch, swift].some((v) => v.trim());
    const others = p.enabledMethods.filter((m) => m !== "manual_upi" && m !== "manual_bank");
    const patch = {
      enabledPaymentMethods: [
        ...(upi ? ["manual_upi"] : []),
        ...(bank ? ["manual_bank"] : []),
        ...others,
      ],
      upiVpa: vpa.trim() || null,
      upiPayeeName: payee.trim() || null,
      upiQrImage: qr,
      bankDetails: anyBank
        ? {
            accountName: acctName.trim(),
            accountNumber: acctNo.replace(/\s+/g, ""),
            ifsc: ifsc.trim().toUpperCase(),
            bankName: bankName.trim(),
            ...(branch.trim() ? { branch: branch.trim() } : {}),
            ...(swift.trim() ? { swift: swift.trim().toUpperCase() } : {}),
          }
        : null,
    };
    setSaving(true);
    try {
      const res = await updateSettings({ patch });
      if (!res.ok) {
        const next: Record<string, string> = {};
        for (const [path, msgs] of Object.entries(res.error.fieldErrors ?? {})) {
          const id = FIELD_IDS[path];
          if (id && msgs[0] && !next[id]) next[id] = msgs[0];
        }
        setErrors(next);
        toast.error(res.error.message);
        return;
      }
      setErrors({});
      toast.success("Payment details saved", {
        description: "Customers see them at checkout and on their order page.",
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="manual-payment-settings">
      <p className="text-body-sm text-fg-muted">
        These details are shown to customers at checkout and on their order page. A method that is
        switched on but missing its details is hidden from checkout until you fill them in.
      </p>

      <section
        aria-labelledby="pm-upi"
        className="space-y-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex items-center gap-3">
          <Switch id="st-upi" checked={upi} disabled={ro} onCheckedChange={setUpi} />
          <Label htmlFor="st-upi" id="pm-upi">
            UPI enabled
          </Label>
          {upi && !upiReady ? (
            <span className="text-caption text-warning">Add a UPI ID to show UPI at checkout</span>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_200px]">
          <div className="space-y-4">
            <Field id="st-vpa" label="UPI ID (VPA)" required={upi} error={errors["st-vpa"]}>
              <Input
                id="st-vpa"
                value={vpa}
                onChange={(e) => setVpa(e.target.value)}
                className="font-mono"
                disabled={ro}
                placeholder="yourname@okhdfcbank"
              />
            </Field>
            <Field
              id="st-payee"
              label="Payee name"
              optional
              hint="Shown in the customer's UPI app. Defaults to your legal / site name."
              error={errors["st-payee"]}
            >
              <Input
                id="st-payee"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                disabled={ro}
              />
            </Field>
          </div>
          <Field
            id="st-qr"
            label="UPI QR code image"
            optional
            hint="Download it from your bank / UPI business app. PNG, JPEG or WebP, max 220 KB."
            error={errors["st-qr"]}
            className="sm:col-span-1"
          >
            <input
              ref={fileRef}
              id="st-qr"
              type="file"
              accept={QR_MIMES.join(",")}
              className="block w-full text-body-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5"
              disabled={ro}
              onChange={(e) => void onPickQr(e.target.files?.[0])}
            />
          </Field>
          <div className="space-y-1.5">
            <span className="text-body-sm font-semibold">Preview</span>
            {qr ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL */}
                <img
                  src={qr}
                  alt="Uploaded UPI QR code"
                  className="size-40 rounded-md border border-border bg-white object-contain p-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={ro}
                  onClick={() => {
                    setQr(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  Remove QR
                </Button>
              </div>
            ) : (
              <p className="text-caption text-fg-muted">
                No QR uploaded — customers see the UPI ID and an &ldquo;Open in UPI app&rdquo; link.
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="pm-bank"
        className="space-y-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex items-center gap-3">
          <Switch id="st-bank" checked={bank} disabled={ro} onCheckedChange={setBank} />
          <Label htmlFor="st-bank" id="pm-bank">
            Bank transfer enabled
          </Label>
          {bank && !bankReady ? (
            <span className="text-caption text-warning">
              Fill in the bank details to show bank transfer at checkout
            </span>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="st-acct-name" label="Account name" required error={errors["st-acct-name"]}>
            <Input
              id="st-acct-name"
              value={acctName}
              onChange={(e) => setAcctName(e.target.value)}
              disabled={ro}
            />
          </Field>
          <Field id="st-acct-no" label="Account number" required error={errors["st-acct-no"]}>
            <Input
              id="st-acct-no"
              value={acctNo}
              onChange={(e) => setAcctNo(e.target.value)}
              className="font-mono"
              inputMode="numeric"
              disabled={ro}
            />
          </Field>
          <Field id="st-ifsc" label="IFSC" required error={errors["st-ifsc"]}>
            <Input
              id="st-ifsc"
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value)}
              className="font-mono uppercase"
              disabled={ro}
            />
          </Field>
          <Field id="st-bank-name" label="Bank name" required error={errors["st-bank-name"]}>
            <Input
              id="st-bank-name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              disabled={ro}
            />
          </Field>
          <Field id="st-branch" label="Branch" optional error={errors["st-branch"]}>
            <Input
              id="st-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={ro}
            />
          </Field>
          <Field id="st-swift" label="SWIFT" optional error={errors["st-swift"]}>
            <Input
              id="st-swift"
              value={swift}
              onChange={(e) => setSwift(e.target.value)}
              className="font-mono uppercase"
              disabled={ro}
            />
          </Field>
        </div>
      </section>

      {!upi && !bank ? (
        <Banner tone="warning">
          Both manual methods are off — customers can only pay through a gateway (if one is
          enabled).
        </Banner>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={ro} loading={saving} onClick={() => void save()}>
          Save payment details
        </Button>
      </div>
    </div>
  );
}
