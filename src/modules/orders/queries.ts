"use server";

/**
 * `orders` read-only queries (API-COM-06 listOrdersAdmin / getOrderAdmin, PHASE-04).
 * Queries are `defineAction` reads that never mutate; the underlying service methods already
 * assert `orders.read`.
 */
import { defineAction } from "@/lib/actions/envelope";
import {
  getMyOrderInput,
  getOrderAdminInput,
  listMyOrdersInput,
  listOrdersAdminInput,
} from "./types";
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

export const listMyOrdersQuery = defineAction({
  name: "API-COM-05 listMyOrders",
  permission: "commerce.self",
  input: listMyOrdersInput,
  handler: (input, ctx) => ordersService.listMyOrders(ctx, input),
});

/**
 * API-COM-05 `getMyOrder` — single-order counterpart of `listMyOrders`, for the order status
 * screen (SCR-ACC-11). `ordersService.getMyOrder` was already fully implemented (scoped by
 * `orders.user_id = ctx.userId`, `NOT_FOUND` otherwise) but never had a `defineAction` wrapper.
 * Takes the public `orderNo` (`CK-ORD-000001`), not the internal `orderId` -- it's the identifier
 * already shown to the customer everywhere else (purchases list, invoices, emails).
 */
export const getMyOrderQuery = defineAction({
  name: "API-COM-05 getMyOrder",
  permission: "commerce.self",
  input: getMyOrderInput,
  handler: (input, ctx) => ordersService.getMyOrder(ctx, input),
});
