"use server";

import { defineAction } from "@/lib/actions/envelope";
import { issueInvoiceInput } from "./types";
import { invoicesService } from "./service";
import { withTx } from "@/lib/db";

export const issueInvoiceAction = defineAction({
  name: "API-COM-14 invoice.issue",
  permission: "invoices.issue",
  input: issueInvoiceInput,
  handler: async (input, ctx) => {
    return await withTx(async (tx) => {
      return await invoicesService.issueInvoice(input, { userId: ctx.userId }, tx);
    });
  },
});
