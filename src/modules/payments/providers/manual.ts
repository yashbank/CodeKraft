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

export const defaultManualDeps: ManualProviderDeps = {
  async getUpiVpa(tx: TxCtx): Promise<string | null> {
    const settings = await settingsService.load(tx);
    return (settings.upiVpa as string) || "codekraft@upi";
  },
  async getBankDetails(tx: TxCtx): Promise<BankDetails | null> {
    const settings = await settingsService.load(tx);
    const b = settings.bankDetails as any;
    if (!b) {
      return {
        accountName: "CodeKraft Inc.",
        accountNo: "1234567890",
        ifsc: "HDFC0001234",
        bankName: "HDFC Bank",
      };
    }
    return {
      accountName: b.accountName,
      accountNo: b.accountNo || b.accountNumber || "1234567890",
      ifsc: b.ifsc,
      bankName: b.bankName,
      branch: b.branch,
      swift: b.swift,
    };
  },
  async getBaseCurrency(tx: TxCtx): Promise<"INR"> {
    const settings = await settingsService.load(tx);
    return (settings.baseCurrency as "INR") || "INR";
  },
  async renderQr(upiUri: string): Promise<string> {
    // Generate inline data URL SVG representation of the QR / UPI URI
    const encoded = encodeURIComponent(upiUri);
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="10" y="50" font-size="10">UPI QR</text><rect width="100" height="100" fill="none" stroke="black"/><desc>${encoded}</desc></svg>`;
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
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "UPI is only available for INR payments",
        );
      }

      const vpa = (await this.deps.getUpiVpa(ctx)) || "codekraft@upi";
      const dueRupees = (order.amountDue.amountMinor / 100).toFixed(2);
      const upiUri = `upi://pay?pa=${vpa}&pn=CodeKraft&am=${dueRupees}&cu=INR&tn=${order.orderNo}`;
      const qrDataUrl = await this.deps.renderQr(upiUri);

      return {
        instructions: {
          method: "manual_upi",
          vpa,
          payeeName: "CodeKraft",
          amount: order.amountDue,
          note: order.orderNo,
          upiUri,
          qrDataUrl,
        },
      };
    }

    if (method === "manual_bank") {
      const details = (await this.deps.getBankDetails(ctx)) || {
        accountName: "CodeKraft Inc.",
        accountNo: "1234567890",
        ifsc: "HDFC0001234",
        bankName: "HDFC Bank",
      };

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

    throw new AppError(
      ErrorCode.STATE_INVALID,
      `Unsupported manual payment method: ${method}`,
    );
  }

  async confirm(
    _ctx: TxCtx,
    payment: PaymentRow,
    input: ConfirmInput,
  ): Promise<PaymentResult> {
    const amounts = computeManualConfirmAmounts(
      payment.amountDueMinor,
      input.amountReceivedMinor,
    );

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
