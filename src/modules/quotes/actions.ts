"use server";

import { defineAction } from "@/lib/actions/envelope";
import {
  acceptCustomQuoteInput,
  cancelCustomQuoteInput,
  createCustomQuoteInput,
  rejectCustomQuoteInput,
  searchCustomersInput,
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

export const rejectCustomQuoteAction = defineAction({
  name: "API-COM-10 quote.reject",
  permission: "commerce.self",
  input: rejectCustomQuoteInput,
  handler: async (input, ctx) => {
    return await quotesService.rejectCustomQuote(ctx, input);
  },
});

export const searchQuoteCustomersAction = defineAction({
  name: "API-COM-09 quote.searchCustomers",
  permission: "customers.read",
  input: searchCustomersInput,
  handler: async (input, ctx) => {
    return await quotesService.searchCustomers(ctx, input);
  },
});
