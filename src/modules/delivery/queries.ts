"use server";

/**
 * Delivery read queries (docs/06 §2.5 API-DEL-10 `listDeliveryTasks`; PHASE-06).
 * Uses defineAction (SA-07).
 */
import { defineAction } from "@/lib/actions/envelope";
import { listDeliveryTasksSchema } from "./types";
import { deliveryService } from "./service";

export const listDeliveryTasksQuery = defineAction({
  name: "API-DEL-10 delivery_task.list",
  input: listDeliveryTasksSchema,
  permission: "delivery.tasks.write",
  handler: (input, ctx) => deliveryService.listDeliveryTasks(ctx, input),
});
