/** `orders` read models (docs/06 API-COM-01, API-COM-05, API-COM-06) — never mutate. */
import { defineAction } from "@/lib/actions/envelope";
import { ordersService } from "./service";
import {
  getMyOrderInput,
  getOrderAdminInput,
  listMyOrdersInput,
  listOrdersAdminInput,
  previewCheckoutInput,
} from "./types";

export const previewCheckout = defineAction({
  name: "API-COM-01 checkout.preview",
  input: previewCheckoutInput,
  permission: "commerce.self",
  handler: (input, ctx) => ordersService.previewCheckout(ctx, input),
});

export const listMyOrders = defineAction({
  name: "API-COM-05 orders.list_mine",
  input: listMyOrdersInput,
  permission: "commerce.self",
  handler: (input, ctx) => ordersService.listMyOrders(ctx, input),
});

export const getMyOrder = defineAction({
  name: "API-COM-05 orders.get_mine",
  input: getMyOrderInput,
  permission: "commerce.self",
  handler: (input, ctx) => ordersService.getMyOrder(ctx, input),
});

export const listOrdersAdmin = defineAction({
  name: "API-COM-06 orders.list_admin",
  input: listOrdersAdminInput,
  permission: "orders.read",
  handler: (input, ctx) => ordersService.listOrdersAdmin(ctx, input),
});

export const getOrderAdmin = defineAction({
  name: "API-COM-06 orders.get_admin",
  input: getOrderAdminInput,
  permission: "orders.read",
  handler: (input, ctx) => ordersService.getOrderAdmin(ctx, input),
});
