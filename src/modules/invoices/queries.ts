"use server";

import { defineAction } from "@/lib/actions/envelope";
import { getInvoicePdfUrlInput, listInvoicesAdminInput, listMyInvoicesInput } from "./types";
import { invoicesService } from "./service";

export const getInvoicePdfUrlQuery = defineAction({
  name: "API-COM-12 invoice.pdf_url",
  input: getInvoicePdfUrlInput,
  handler: async (input, ctx) => {
    return await invoicesService.getInvoicePdfUrl(ctx, input);
  },
});

export const listInvoicesAdminQuery = defineAction({
  name: "API-COM-13 invoice.list_admin",
  permission: "invoices.read",
  input: listInvoicesAdminInput,
  handler: async (input, ctx) => {
    return await invoicesService.listInvoicesAdmin(ctx, input);
  },
});

export const listMyInvoicesQuery = defineAction({
  name: "API-COM-13 invoice.list_my",
  input: listMyInvoicesInput,
  handler: async (input, ctx) => {
    return await invoicesService.listMyInvoices(ctx, input);
  },
});
