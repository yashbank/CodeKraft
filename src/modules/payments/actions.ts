"use server";

import { defineAction } from "@/lib/actions/envelope";
import { proposeRefundInput } from "./types";
import { paymentsService } from "./service";

export const proposeRefundAction = defineAction({
  name: "API-PAY-05 refund.propose",
  permission: "refunds.propose",
  input: proposeRefundInput,
  handler: async (input, ctx) => {
    return await paymentsService.proposeRefund(ctx, input);
  },
});
