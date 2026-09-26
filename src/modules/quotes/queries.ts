"use server";

import { defineAction, definePublicAction } from "@/lib/actions/envelope";
import { getQuoteInput, listQuotesInput } from "./types";
import { quotesService } from "./service";

export const getQuoteQuery = definePublicAction({
  name: "API-COM-10 quote.get",
  input: getQuoteInput,
  handler: async (input, ctx) => {
    return await quotesService.getQuote(ctx, input);
  },
});

export const listQuotesQuery = defineAction({
  name: "API-COM-09 quote.list",
  permission: "orders.read",
  input: listQuotesInput,
  handler: async (input, ctx) => {
    return await quotesService.listQuotes(ctx, input);
  },
});
