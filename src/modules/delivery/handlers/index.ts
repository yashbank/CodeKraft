import {
  createDeliveryHandlerRegistry,
  type DeliveryHandlerRegistry,
} from "../handler";
import { downloadDeliveryHandler } from "./download";
import { licenseDeliveryHandler } from "./license";
import { saasDeliveryHandler } from "./saas";
import { hostedDeliveryHandler } from "./hosted";
import { serviceDeliveryHandler } from "./service";
import { customDeliveryHandler } from "./custom";

export function createDefaultDeliveryHandlerRegistry(): DeliveryHandlerRegistry {
  const registry = createDeliveryHandlerRegistry();
  registry.register(downloadDeliveryHandler);
  registry.register(licenseDeliveryHandler);
  registry.register(saasDeliveryHandler);
  registry.register(hostedDeliveryHandler);
  registry.register(serviceDeliveryHandler);
  registry.register(customDeliveryHandler);
  return registry;
}

export const defaultDeliveryHandlerRegistry = createDefaultDeliveryHandlerRegistry();
