/**
 * `ManualProvider` — docs/06 §4.2 (release 1, D-501, D-516). Serves `manual_upi` and `manual_bank`.
 *
 *  - `createIntent(manual_upi)`: `upi://pay?pa=<vpa>&pn=CodeKraft&am=<rupees 2dp>&cu=INR&tn=<orderNo>`
 *    plus a QR data URL (`qrcode`, pure JS); refused when the base currency is not INR.
 *  - `createIntent(manual_bank)`: `BankInstructions` from `site_settings.bank_details`, `reference = orderNo`.
 *  - `confirm`: pure amounts (`computeManualConfirmAmounts`); the admin's reference is kept in
 *    `provider_payload.adminReference`, the customer's stays in `customer_reference`.
 *  - `refund`: records the hand-made transfer reference (BR-09).
 *
 * The provider never writes ledger or order rows (MASTER_SPEC §4.4).
 */
import QRCode from "qrcode";
import { AppError, ErrorCode } from "@/lib/errors";
import { type Currency, toDecimalString } from "@/lib/money";
import {
  type BankInstructions,
  type ConfirmInput,
  type CreateIntentResult,
  MANUAL_PROVIDER_KEYS,
  type ManualProviderDeps,
  type OrderForPayment,
  type PaymentMethodKey,
  type PaymentProvider,
  type PaymentResult,
  type PaymentRow,
  type RefundResult,
  type UpiInstructions,
  computeManualConfirmAmounts,
} from "../provider";
import type { TxCtx } from "@/lib/db";

export const UPI_PAYEE_NAME = "CodeKraft";

/** Build the UPI intent URI exactly as docs/06 §4.2 specifies (amount in rupees with two decimals). */
export function buildUpiUri(input: { vpa: string; amountMinor: number; orderNo: string }): string {
  const am = toDecimalString(input.amountMinor);
  return `upi://pay?pa=${input.vpa}&pn=${UPI_PAYEE_NAME}&am=${am}&cu=INR&tn=${input.orderNo}`;
}

/** `qrcode` → PNG data URL (no canvas; safe on serverless). */
export function renderQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 1, width: 320 });
}

export class ManualProvider implements PaymentProvider {
  readonly keys: PaymentMethodKey[] = [...MANUAL_PROVIDER_KEYS];

  constructor(private readonly deps: ManualProviderDeps) {}

  async createIntent(
    ctx: TxCtx,
    order: OrderForPayment,
    method: PaymentMethodKey,
  ): Promise<CreateIntentResult> {
    if (method === "manual_upi") return { instructions: await this.upiIntent(ctx, order) };
    if (method === "manual_bank") return { instructions: await this.bankIntent(ctx, order) };
    throw new AppError(ErrorCode.STATE_INVALID, `ManualProvider does not serve ${method}.`);
  }

  private async upiIntent(ctx: TxCtx, order: OrderForPayment): Promise<UpiInstructions> {
    const baseCurrency: Currency = await this.deps.getBaseCurrency(ctx);
    if (baseCurrency !== "INR" || order.amountDue.currency !== "INR") {
      throw new AppError(ErrorCode.STATE_INVALID, "UPI payments are only available in INR.");
    }
    const vpa = await this.deps.getUpiVpa(ctx);
    if (vpa === null || vpa === "") {
      throw new AppError(ErrorCode.STATE_INVALID, "UPI is not configured (no VPA in settings).");
    }
    const upiUri = buildUpiUri({ vpa, amountMinor: order.amountDue.amountMinor, orderNo: order.orderNo });
    const qrDataUrl = await this.deps.renderQr(upiUri);
    return {
      method: "manual_upi",
      vpa,
      payeeName: UPI_PAYEE_NAME,
      amount: order.amountDue,
      note: order.orderNo,
      upiUri,
      qrDataUrl,
    };
  }

  private async bankIntent(ctx: TxCtx, order: OrderForPayment): Promise<BankInstructions> {
    const bank = await this.deps.getBankDetails(ctx);
    if (bank === null) {
      throw new AppError(ErrorCode.STATE_INVALID, "Bank transfer is not configured in settings.");
    }
    return {
      method: "manual_bank",
      accountName: bank.accountName,
      accountNo: bank.accountNo,
      ifsc: bank.ifsc,
      bankName: bank.bankName,
      ...(bank.branch !== undefined ? { branch: bank.branch } : {}),
      ...(bank.swift !== undefined ? { swift: bank.swift } : {}),
      amount: order.amountDue,
      reference: order.orderNo,
    };
  }

  confirm(_ctx: TxCtx, payment: PaymentRow, input: ConfirmInput): Promise<PaymentResult> {
    const amounts = computeManualConfirmAmounts(payment.amountDueMinor, input.amountReceivedMinor);
    const providerPayload: Record<string, string | null> = {
      adminReference: input.reference,
      receivedOn: input.receivedOn,
      actorId: input.actorId,
      customerReference: payment.customerReference,
    };
    return Promise.resolve({
      status: "confirmed",
      amountReceivedMinor: amounts.amountReceivedMinor,
      gatewayFeeMinor: 0,
      bankShortfallMinor: amounts.bankShortfallMinor,
      customerCreditMinor: amounts.customerCreditMinor,
      reference: input.reference,
      providerPayload,
    });
  }

  refund(_ctx: TxCtx, _payment: PaymentRow, _amountMinor: number, reason: string): Promise<RefundResult> {
    return Promise.resolve({ status: "recorded", reference: reason });
  }
}

/** Provider deps backed by a `SiteSettings` loader (settings module, or the orders fallback). */
export function manualProviderDepsFromSettings(load: (tx: TxCtx) => Promise<{
  upiVpa: string | null;
  bankDetails: { accountName: string; accountNumber: string; ifsc: string; bankName: string; branch?: string } | null;
  baseCurrency: Currency;
}>): ManualProviderDeps {
  return {
    getUpiVpa: async (tx) => (await load(tx)).upiVpa,
    getBankDetails: async (tx) => {
      const b = (await load(tx)).bankDetails;
      if (b === null) return null;
      return {
        accountName: b.accountName,
        accountNo: b.accountNumber,
        ifsc: b.ifsc,
        bankName: b.bankName,
        ...(b.branch !== undefined ? { branch: b.branch } : {}),
      };
    },
    getBaseCurrency: async (tx) => (await load(tx)).baseCurrency,
    renderQr: renderQrDataUrl,
  };
}
