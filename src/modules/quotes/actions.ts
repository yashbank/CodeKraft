"use server";

import { defineAction } from "@/lib/actions/envelope";
import {
  acceptCustomQuoteInput,
  cancelCustomQuoteInput,
  createCustomQuoteInput,
  sendCustomQuoteInput,
} from "./types";
import { quotesService } from "./service";

export const createCustomQuoteAction = defineAction({
  name: "API-COM-09 quote.create",
  permission: "orders.manual.write",
  input: createCustomQuoteInput,
  handler: async (input, ctx) => {
    return await quotesService.createCustomQuote(ctx, input);
  },
});

export const sendCustomQuoteAction = defineAction({
  name: "API-COM-09 quote.send",
  permission: "orders.manual.write",
  input: sendCustomQuoteInput,
  handler: async (input, ctx) => {
    return await quotesService.sendCustomQuote(ctx, input);
  },
});

export const cancelCustomQuoteAction = defineAction({
  name: "API-COM-09 quote.cancel",
  permission: "orders.manual.write",
  input: cancelCustomQuoteInput,
  handler: async (input, ctx) => {
    return await quotesService.cancelCustomQuote(ctx, input);
  },
});

export const acceptCustomQuoteAction = defineAction({
  name: "API-COM-10 quote.accept",
  permission: "commerce.self",
  input: acceptCustomQuoteInput,
  handler: async (input, ctx) => {
    return await quotesService.acceptCustomQuote(ctx, input);
  },
});
