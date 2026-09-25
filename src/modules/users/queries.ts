"use server";

/**
 * Users read queries (API-AUTH-02/06, API-ADM-06/12, API-DASH-01..03, PHASE-03 P3.4).
 * Uses defineAction / definePublicAction (SA-07).
 */
import { z } from "zod";
import { defineAction } from "@/lib/actions/envelope";
import { getCustomerSchema, listCustomersSchema, listPartnersSchema } from "./contracts";
import { usersService } from "./service";

const emptyQueryInput = z.strictObject({});

export const getMeQuery = defineAction({
  name: "API-AUTH-02 me.get",
  input: emptyQueryInput,
  permission: "account.self",
  handler: (_input, ctx) => usersService.getMe(ctx),
});

export const listSessionsQuery = defineAction({
  name: "API-AUTH-06 session.list",
  input: emptyQueryInput,
  permission: "account.self",
  handler: (_input, ctx) => usersService.listSessions(ctx),
});

export const listCustomersQuery = defineAction({
  name: "API-ADM-06 customer.list",
  input: listCustomersSchema,
  permission: "customers.read",
  handler: (input, ctx) => usersService.listCustomers(ctx, input),
});

export const getCustomerQuery = defineAction({
  name: "API-ADM-06 customer.get",
  input: getCustomerSchema,
  permission: "customers.read",
  handler: (input, ctx) => usersService.getCustomer(ctx, input),
});

export const listPartnersQuery = defineAction({
  name: "API-ADM-12 partner.list",
  input: listPartnersSchema,
  permission: "finance.ledger.read_all",
  handler: (input, ctx) => usersService.listPartners(ctx, input),
});

export const getDashboardOverviewQuery = defineAction({
  name: "API-DASH-01 dashboard.overview",
  input: emptyQueryInput,
  permission: "account.self",
  handler: (_input, ctx) => usersService.getDashboardOverview(ctx),
});

export const getPaymentHistoryQuery = defineAction({
  name: "API-DASH-02 dashboard.payment_history",
  input: emptyQueryInput,
  permission: "account.self",
  handler: (_input, ctx) => usersService.getPaymentHistory(ctx),
});

export const getSecurityOverviewQuery = defineAction({
  name: "API-DASH-03 dashboard.security_overview",
  input: emptyQueryInput,
  permission: "account.self",
  handler: (_input, ctx) => usersService.getSecurityOverview(ctx),
});
