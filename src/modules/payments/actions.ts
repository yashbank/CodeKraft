"use server";

import { defineAction } from "@/lib/actions/envelope";
import { confirmPaymentInput, failPaymentInput, proposeRefundInput } from "./types";
import { paymentsService } from "./service";

export const proposeRefundAction = defineAction({
  name: "API-PAY-05 refund.propose",
  permission: "refunds.propose",
  input: proposeRefundInput,
  handler: async (input, ctx) => {
    return await paymentsService.proposeRefund(ctx, input);
  },
});

export const confirmPaymentAction = defineAction({
  name: "API-PAY-03 payment.confirm",
  permission: "payments.confirm",
  input: confirmPaymentInput,
  handler: async (input, ctx) => {
    return await paymentsService.confirmPayment(ctx, input);
  },
});

export const failPaymentAction = defineAction({
  name: "API-PAY-04 payment.fail",
  permission: "payments.confirm",
  input: failPaymentInput,
  handler: async (input, ctx) => {
    return await paymentsService.failPayment(ctx, input);
  },
});
