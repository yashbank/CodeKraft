/**
 * Mapping between the API view of payment instructions (docs/06 §2.4 API-PAY-01, `provider.ts`)
 * and the persisted `payments.instructions` JSON (drizzle/schema/commerce `PaymentInstructions`).
 * Pure functions, no provider key logic beyond the discriminant.
 */
import { assertCurrency } from "@/lib/money";
import type { PaymentInstructions as PersistedInstructions } from "../../../drizzle/schema/commerce";
import type { PaymentInstructions } from "./provider";

export function toPersistedInstructions(api: PaymentInstructions): PersistedInstructions {
  if (api.method === "manual_upi") {
    return {
      method: "manual_upi",
      vpa: api.vpa,
      payeeName: api.payeeName,
      amountMinor: api.amount.amountMinor,
      currency: api.amount.currency,
      upiUri: api.upiUri,
      qrDataUrl: api.qrDataUrl,
      reference: api.note,
    };
  }
  if (api.method === "manual_bank") {
    return {
      method: "manual_bank",
      accountName: api.accountName,
      accountNumber: api.accountNo,
      ifsc: api.ifsc,
      bankName: api.bankName,
      branch: api.branch ?? null,
      swift: api.swift ?? null,
      amountMinor: api.amount.amountMinor,
      currency: api.amount.currency,
      reference: api.reference,
    };
  }
  const { method, ...rest } = api;
  return { method, ...rest };
}

export function toApiInstructions(persisted: PersistedInstructions): PaymentInstructions {
  if (persisted.method === "manual_upi") {
    return {
      method: "manual_upi",
      vpa: persisted.vpa,
      payeeName: persisted.payeeName,
      amount: { amountMinor: persisted.amountMinor, currency: assertCurrency(persisted.currency) },
      note: persisted.reference,
      upiUri: persisted.upiUri,
      qrDataUrl: persisted.qrDataUrl,
    };
  }
  if (persisted.method === "manual_bank") {
    return {
      method: "manual_bank",
      accountName: persisted.accountName,
      accountNo: persisted.accountNumber,
      ifsc: persisted.ifsc,
      bankName: persisted.bankName,
      ...(persisted.branch ? { branch: persisted.branch } : {}),
      ...(persisted.swift ? { swift: persisted.swift } : {}),
      amount: { amountMinor: persisted.amountMinor, currency: assertCurrency(persisted.currency) },
      reference: persisted.reference,
    };
  }
  const { method, ...rest } = persisted;
  return { method, kind: "redirect", ...(rest as Record<string, never>) };
}
