/**
 * R8-01: which manual payment methods actually have customer-facing details configured in admin
 * settings. A method that is enabled but not configured is hidden at checkout (with a notice)
 * instead of showing placeholder UPI ids or bank numbers. Pure — safe to import anywhere.
 */
import { toDecimalString } from "@/lib/money";
import type { BankDetails as SettingsBankDetails, SiteSettings } from "@/modules/settings/types";
import type { BankDetails, PaymentInstructions } from "./provider";

export interface ManualMethodAvailability {
  manual_upi: boolean;
  manual_bank: boolean;
}

export function manualMethodAvailability(
  settings: Pick<SiteSettings, "upiVpa" | "bankDetails">,
): ManualMethodAvailability {
  const b = settings.bankDetails;
  return {
    manual_upi: Boolean(settings.upiVpa?.trim()),
    manual_bank: Boolean(b && b.accountName && b.accountNumber && b.ifsc && b.bankName),
  };
}

export const ALL_MANUAL_AVAILABLE: ManualMethodAvailability = Object.freeze({
  manual_upi: true,
  manual_bank: true,
});

/** Settings bank details -> instruction shape; `null` unless every required field is present. */
export function toBankInstructionDetails(b: SettingsBankDetails | null): BankDetails | null {
  if (!b || !b.accountName || !b.accountNumber || !b.ifsc || !b.bankName) return null;
  return {
    accountName: b.accountName,
    accountNo: b.accountNumber,
    ifsc: b.ifsc,
    bankName: b.bankName,
    branch: b.branch,
    swift: b.swift,
  };
}

/** `upi://pay` deep link (NPCI linking spec); payee name and note are URI-encoded. */
export function buildUpiUri(
  vpa: string,
  payeeName: string,
  amountRupees: string,
  note: string,
): string {
  const q = (v: string) => encodeURIComponent(v);
  // VPA is validated to `[A-Za-z0-9._-]@[A-Za-z]` — left raw; some UPI apps reject `%40`.
  return `upi://pay?pa=${vpa}&pn=${q(payeeName)}&am=${amountRupees}&cu=INR&tn=${q(note)}`;
}

export function upiPayeeName(
  settings: Pick<SiteSettings, "upiPayeeName" | "sellerDetails" | "siteName">,
): string {
  return settings.upiPayeeName?.trim() || settings.sellerDetails?.name || settings.siteName;
}

type LiveSettings = Pick<
  SiteSettings,
  "upiVpa" | "upiPayeeName" | "upiQrImage" | "bankDetails" | "sellerDetails" | "siteName"
>;

/**
 * R8-01: manual instructions are snapshotted on the payment row when the order is placed, so an
 * order placed before admin filled in the UPI/bank settings (or after they changed) would keep
 * showing stale or placeholder details. For a still-open payment, re-derive the payee details
 * from the current settings; `unconfigured: true` tells the UI to show "contact us" instead.
 */
export function withLiveManualDetails(
  instructions: PaymentInstructions | null,
  settings: LiveSettings,
): PaymentInstructions | null {
  if (!instructions) return instructions;
  if (instructions.method === "manual_upi") {
    const vpa = settings.upiVpa?.trim();
    if (!vpa) {
      return { ...instructions, vpa: "", upiUri: "", qrDataUrl: null, unconfigured: true };
    }
    const payeeName = upiPayeeName(settings);
    return {
      ...instructions,
      vpa,
      payeeName,
      upiUri: buildUpiUri(
        vpa,
        payeeName,
        toDecimalString(instructions.amount.amountMinor),
        instructions.note,
      ),
      qrDataUrl: settings.upiQrImage || null,
      unconfigured: undefined,
    };
  }
  if (instructions.method === "manual_bank") {
    const d = toBankInstructionDetails(settings.bankDetails);
    if (!d) {
      return {
        ...instructions,
        accountName: "",
        accountNo: "",
        ifsc: "",
        bankName: "",
        branch: undefined,
        swift: undefined,
        unconfigured: true,
      };
    }
    return { ...instructions, ...d, unconfigured: undefined };
  }
  return instructions;
}
