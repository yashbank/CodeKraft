"use server";

import { defineAction } from "@/lib/actions/envelope";
import { createManualOrderInput } from "./types";
import { ordersService } from "./service";

export const createManualOrderAction = defineAction({
  name: "API-COM-07 order.manual.create",
  permission: "orders.manual.write",
  input: createManualOrderInput,
  handler: async (input, ctx) => {
    return await ordersService.createManualOrder(ctx, input);
  },
});
