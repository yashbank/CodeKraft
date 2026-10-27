import { toDecimalString } from "@/lib/money";
/**
 * Manual payment provider (UPI and NEFT/RTGS bank transfers, docs/06 §4.2, D-501).
 */
import type { TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { settingsService } from "@/modules/settings/service";
import type {
  BankDetails,
  ConfirmInput,
  CreateIntentResult,
  ManualProviderDeps,
  OrderForPayment,
  PaymentMethodKey,
  PaymentProvider,
  PaymentResult,
  PaymentRow,
  RefundResult,
} from "../provider";
import { computeManualConfirmAmounts } from "../provider";
import { buildUpiUri, toBankInstructionDetails, upiPayeeName } from "../availability";

/**
 * Customer-facing message when an enabled manual method has no details configured yet (R8-01).
 * Checkout hides such methods up front (`manualMethodAvailability`); this guards direct calls.
 */
export const UPI_NOT_CONFIGURED_MESSAGE =
  "UPI payment isn't set up yet. Please choose another payment method or contact us.";
export const BANK_NOT_CONFIGURED_MESSAGE =
  "Bank transfer isn't set up yet. Please choose another payment method or contact us.";

export const defaultManualDeps: ManualProviderDeps = {
  async getUpiVpa(tx: TxCtx): Promise<string | null> {
    const settings = await settingsService.load(tx);
    return settings.upiVpa?.trim() || null;
  },
  async getBankDetails(tx: TxCtx): Promise<BankDetails | null> {
    const settings = await settingsService.load(tx);
    return toBankInstructionDetails(settings.bankDetails);
  },
  async getBaseCurrency(tx: TxCtx): Promise<"INR"> {
    const settings = await settingsService.load(tx);
    return (settings.baseCurrency as "INR") || "INR";
  },
  async getUpiQrImage(tx: TxCtx): Promise<string | null> {
    const settings = await settingsService.load(tx);
    return settings.upiQrImage || null;
  },
  async getUpiPayeeName(tx: TxCtx): Promise<string> {
    const settings = await settingsService.load(tx);
    return upiPayeeName(settings);
  },
};

export class ManualProvider implements PaymentProvider {
  readonly keys: PaymentMethodKey[] = ["manual_upi", "manual_bank"];

  constructor(private readonly deps: ManualProviderDeps = defaultManualDeps) {}

  async createIntent(
    ctx: TxCtx,
    order: OrderForPayment,
    method: PaymentMethodKey,
  ): Promise<CreateIntentResult> {
    if (method === "manual_upi") {
      if (order.amountDue.currency !== "INR") {
        throw new AppError(ErrorCode.STATE_INVALID, "UPI is only available for INR payments");
      }

      const vpa = await this.deps.getUpiVpa(ctx);
      if (!vpa) throw new AppError(ErrorCode.STATE_INVALID, UPI_NOT_CONFIGURED_MESSAGE);
      const payeeName = await this.deps.getUpiPayeeName(ctx);
      const dueRupees = toDecimalString(order.amountDue.amountMinor);
      const upiUri = buildUpiUri(vpa, payeeName, dueRupees, order.orderNo);
      const qrDataUrl = await this.deps.getUpiQrImage(ctx);

      return {
        instructions: {
          method: "manual_upi",
          vpa,
          payeeName,
          amount: order.amountDue,
          note: order.orderNo,
          upiUri,
          qrDataUrl,
        },
      };
    }

    if (method === "manual_bank") {
      const details = await this.deps.getBankDetails(ctx);
      if (!details) throw new AppError(ErrorCode.STATE_INVALID, BANK_NOT_CONFIGURED_MESSAGE);

      return {
        instructions: {
          method: "manual_bank",
          accountName: details.accountName,
          accountNo: details.accountNo,
          ifsc: details.ifsc,
          bankName: details.bankName,
          branch: details.branch,
          swift: details.swift,
          amount: order.amountDue,
          reference: order.orderNo,
        },
      };
    }

    throw new AppError(ErrorCode.STATE_INVALID, `Unsupported manual payment method: ${method}`);
  }

  async confirm(_ctx: TxCtx, payment: PaymentRow, input: ConfirmInput): Promise<PaymentResult> {
    const amounts = computeManualConfirmAmounts(payment.amountDueMinor, input.amountReceivedMinor);

    return {
      status: "confirmed",
      amountReceivedMinor: amounts.amountReceivedMinor,
      gatewayFeeMinor: 0,
      bankShortfallMinor: amounts.bankShortfallMinor,
      customerCreditMinor: amounts.customerCreditMinor,
      reference: input.reference,
    };
  }

  async refund(
    _ctx: TxCtx,
    payment: PaymentRow,
    _amountMinor: number,
    reason: string,
  ): Promise<RefundResult> {
    return {
      status: "recorded",
      reference: `manual-refund-${payment.id}`,
      failureReason: reason,
    };
  }
}

export const manualProvider = new ManualProvider();
