/**
 * Delivery handler registry keyed by `delivery_type` (docs/04 §7.3, PHASE-05 P5.2).
 * `defaultDeliveryHandlerRegistry()` returns a fresh registry with the six release-1 handlers;
 * tests build their own with `createDeliveryHandlerRegistry()` and fakes.
 */
import { type DeliveryHandlerRegistry, createDeliveryHandlerRegistry } from "../handler";
import { customHandler } from "./custom";
import { downloadHandler } from "./download";
import { hostedHandler } from "./hosted";
import { licenseHandler } from "./license";
import { saasHandler } from "./saas";
import { serviceHandler } from "./service";

export { customHandler, downloadHandler, hostedHandler, licenseHandler, saasHandler, serviceHandler };
export { parseProvisioningNotes } from "./provisioned";
export { stepsFromOffering } from "./service";

export const DELIVERY_HANDLERS = [
  saasHandler,
  hostedHandler,
  downloadHandler,
  licenseHandler,
  serviceHandler,
  customHandler,
] as const;

export function defaultDeliveryHandlerRegistry(): DeliveryHandlerRegistry {
  const registry = createDeliveryHandlerRegistry();
  for (const handler of DELIVERY_HANDLERS) registry.register(handler);
  return registry;
}
