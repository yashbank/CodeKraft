/**
 * `offerings` Server Actions (docs/06 API-CAT-03/04/05). Every export is a `defineAction` (SA-07)
 * with `catalog.write`; the D-512 `own_products` scope is applied by the service.
 */
import { defineAction } from "@/lib/actions/envelope";
import {
  deleteOfferingSchema,
  setOfferingPaymentMethodsSchema,
  setOfferingPricesSchema,
  upsertOfferingSchema,
} from "./contracts";
import { offeringsService } from "./service";

/** API-CAT-03 `upsertOffering`. */
export const upsertOffering = defineAction({
  name: "API-CAT-03 offering.upsert",
  input: upsertOfferingSchema,
  permission: "catalog.write",
  handler: (input, ctx) => offeringsService.upsertOffering(ctx, input),
});

/** API-CAT-03 `deleteOffering` — hard delete with zero `order_items`, else demoted to `inactive`. */
export const deleteOffering = defineAction({
  name: "API-CAT-03 offering.delete",
  input: deleteOfferingSchema,
  permission: "catalog.write",
  handler: (input, ctx) => offeringsService.deleteOffering(ctx, input),
});

/** API-CAT-04 `setOfferingPrices` — replace set; base-currency row mandatory (D-502). */
export const setOfferingPrices = defineAction({
  name: "API-CAT-04 offering.prices.set",
  input: setOfferingPricesSchema,
  permission: "catalog.write",
  handler: (input, ctx) => offeringsService.setOfferingPrices(ctx, input),
});

/** API-CAT-05 `setOfferingPaymentMethods` — gateway methods need their flag + settings toggle. */
export const setOfferingPaymentMethods = defineAction({
  name: "API-CAT-05 offering.methods.set",
  input: setOfferingPaymentMethodsSchema,
  permission: "catalog.write",
  handler: (input, ctx) => offeringsService.setOfferingPaymentMethods(ctx, input),
});
