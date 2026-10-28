"use server";

/**
 * Delivery Server Actions (docs/06 §2.5 API-DEL-10 `completeDeliveryTask` / assign; PHASE-06).
 * Uses defineAction (SA-07).
 */
import { defineAction } from "@/lib/actions/envelope";
import {
  assignDeliveryTaskSchema,
  completeDeliveryTaskSchema,
  markServiceStepSchema,
  setLicenseKeySchema,
} from "./types";
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

/** API-DEL-08 `setLicenseKey` (R8-03) — encrypts the key, closes the open provision task. */
export const setLicenseKeyAction = defineAction({
  name: "API-DEL-08 setLicenseKey",
  input: setLicenseKeySchema,
  permission: "delivery.tasks.write",
  handler: (input, ctx) => deliveryService.setLicenseKey(ctx, input),
});

/** API-DEL-09 `markServiceStep` — admin ticks a service step done; all done fulfils the order. */
export const markServiceStepAction = defineAction({
  name: "API-DEL-09 service_step.mark",
  input: markServiceStepSchema,
  permission: "delivery.tasks.write",
  handler: (input, ctx) => deliveryService.markServiceStep(ctx, input),
});
