/**
 * `orders` Server Actions (docs/06 §2.3 API-COM-02/03/04/07). Zod first, permission second, then
 * the service; every mutation reached from an admin session audits inside its transaction.
 * Orders are private, so no cache tag is revalidated (`ORDERS_CACHE_TAGS` is empty).
 */
import { defineAction } from "@/lib/actions/envelope";
import { ordersService } from "./service";
import {
  cancelMyOrderInput,
  createManualOrderInput,
  createOrderInput,
  retryPaymentInput,
} from "./types";

export const createOrder = defineAction({
  name: "API-COM-02 order.create",
  input: createOrderInput,
  permission: "commerce.self",
  handler: (input, ctx) => ordersService.createOrder(ctx, input),
});

export const cancelMyOrder = defineAction({
  name: "API-COM-03 order.cancel",
  input: cancelMyOrderInput,
  permission: "commerce.self",
  handler: (input, ctx) => ordersService.cancelMyOrder(ctx, input),
});

export const retryPayment = defineAction({
  name: "API-COM-04 order.retry_payment",
  input: retryPaymentInput,
  permission: "commerce.self",
  handler: (input, ctx) => ordersService.retryPayment(ctx, input),
});

export const createManualOrder = defineAction({
  name: "API-COM-07 order.manual_create",
  input: createManualOrderInput,
  permission: "orders.manual.write",
  handler: (input, ctx) => ordersService.createManualOrder(ctx, input),
});
