"use server";

/**
 * Delivery Server Actions (docs/06 §2.5 API-DEL-10 `completeDeliveryTask` / assign; PHASE-06).
 * Uses defineAction (SA-07).
 */
import { defineAction } from "@/lib/actions/envelope";
import { assignDeliveryTaskSchema, completeDeliveryTaskSchema } from "./types";
import { deliveryService } from "./service";

export const completeDeliveryTaskAction = defineAction({
  name: "API-DEL-10 delivery_task.complete",
  input: completeDeliveryTaskSchema,
  permission: "delivery.tasks.write",
  handler: (input, ctx) => deliveryService.completeDeliveryTask(ctx, input),
});

export const assignDeliveryTaskAction = defineAction({
  name: "API-DEL-10 delivery_task.assign",
  input: assignDeliveryTaskSchema,
  permission: "delivery.tasks.write",
  handler: (input, ctx) => deliveryService.assignDeliveryTask(ctx, input),
});
