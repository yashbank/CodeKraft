"use server";

import { defineAction } from "@/lib/actions/envelope";
import {
  confirmPaymentInput,
  failPaymentInput,
  proposeRefundInput,
  submitPaymentReferenceInput,
} from "./types";
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

/**
 * API-PAY-02 `submitPaymentReference` — customer submits their UPI/bank transfer reference
 * (UTR) after paying the manual instructions from `createOrder`. This does NOT confirm the
 * payment — it only moves `initiated|submitted -> submitted` and notifies admins; an admin still
 * has to `confirmPayment` (`payments.confirm`) before the order is `paid` and access unlocks.
 */
export const submitPaymentReferenceAction = defineAction({
  name: "API-PAY-02 payment.submit_reference",
  permission: "commerce.self",
  input: submitPaymentReferenceInput,
  handler: async (input, ctx) => {
    return await paymentsService.submitPaymentReference(ctx, input);
  },
});
