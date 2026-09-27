"use server";

import { defineAction } from "@/lib/actions/envelope";
import { createManualOrderInput, createOrderInput, previewCheckoutInput } from "./types";
import { ordersService } from "./service";

export const createManualOrderAction = defineAction({
  name: "API-COM-07 order.manual.create",
  permission: "orders.manual.write",
  input: createManualOrderInput,
  handler: async (input, ctx) => {
    return await ordersService.createManualOrder(ctx, input);
  },
});

// ---------------------------------------------------------------------------------------------
// Customer-facing checkout actions (`commerce.self`) — the manual-order action above is admin-only.
// ---------------------------------------------------------------------------------------------

/** API-COM-01 `previewCheckout` — read, but goes through `defineAction` for auth + Zod like every other action here. */
export const previewCheckoutAction = defineAction({
  name: "API-COM-01 checkout.preview",
  permission: "commerce.self",
  input: previewCheckoutInput,
  handler: async (input, ctx) => {
    return await ordersService.previewCheckout(ctx, input);
  },
});

/** API-COM-02 `createOrder` — single-offering "Buy now" checkout; see `service.ts` for the full flow. */
export const createOrderAction = defineAction({
  name: "API-COM-02 order.create",
  permission: "commerce.self",
  input: createOrderInput,
  handler: async (input, ctx) => {
    return await ordersService.createOrder(ctx, input);
  },
});
