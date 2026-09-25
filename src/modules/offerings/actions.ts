/**
 * Offerings Server Actions (docs/06 §1.3, SA-07, PHASE-03 P3.7).
 * Every action is wrapped with defineAction.
 */
import { defineAction } from "@/lib/actions";
import {
  deleteOfferingSchema,
  setOfferingPaymentMethodsSchema,
  setOfferingPricesSchema,
  upsertOfferingSchema,
} from "./contracts";
import { offeringsService } from "./service";

export const upsertOfferingAction = defineAction({
  name: "API-CAT-03 upsertOffering",
  input: upsertOfferingSchema,
  handler: (input, ctx) => offeringsService.upsertOffering(ctx, input),
});

export const deleteOfferingAction = defineAction({
  name: "API-CAT-03 deleteOffering",
  input: deleteOfferingSchema,
  handler: (input, ctx) => offeringsService.deleteOffering(ctx, input),
});

export const setOfferingPricesAction = defineAction({
  name: "API-CAT-04 setOfferingPrices",
  input: setOfferingPricesSchema,
  handler: (input, ctx) => offeringsService.setOfferingPrices(ctx, input),
});

export const setOfferingPaymentMethodsAction = defineAction({
  name: "API-CAT-05 setOfferingPaymentMethods",
  input: setOfferingPaymentMethodsSchema,
  handler: (input, ctx) => offeringsService.setOfferingPaymentMethods(ctx, input),
});
