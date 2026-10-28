"use server";

import { defineAction, definePublicAction } from "@/lib/actions/envelope";
import { z } from "zod";
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

/** Account > Quotes: every quote addressed to the signed-in customer (drafts are never shown). */
export const listMyQuotesQuery = defineAction({
  name: "API-COM-10 quote.listMine",
  permission: "commerce.self",
  input: z.object({}).strict(),
  handler: async (_input, ctx) => {
    return await quotesService.listMyQuotes(ctx);
  },
});
