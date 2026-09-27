"use server";

/**
 * `orders` read-only queries (API-COM-06 listOrdersAdmin / getOrderAdmin, PHASE-04).
 * Queries are `defineAction` reads that never mutate; the underlying service methods already
 * assert `orders.read`.
 */
import { defineAction } from "@/lib/actions/envelope";
import { getOrderAdminInput, listOrdersAdminInput } from "./types";
import { ordersService } from "./service";

export const listOrdersAdminQuery = defineAction({
  name: "API-COM-06 listOrdersAdmin",
  permission: "orders.read",
  input: listOrdersAdminInput,
  handler: (input, ctx) => ordersService.listOrdersAdmin(ctx, input),
});

export const getOrderAdminQuery = defineAction({
  name: "API-COM-06 getOrderAdmin",
  permission: "orders.read",
  input: getOrderAdminInput,
  handler: (input, ctx) => ordersService.getOrderAdmin(ctx, input),
});
