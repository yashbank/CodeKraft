/**
 * Offerings read-only queries (docs/06 §1.3, SA-07, PHASE-03 P3.7).
 */
import { z } from "zod";
import { definePublicAction } from "@/lib/actions";
import { currencySchema, uuidSchema } from "@/modules/_shared/zod";
import { offeringsService } from "./service";

export const listOfferingsForProductQuery = definePublicAction({
  name: "API-CAT-03 listOfferingsForProduct",
  input: z.strictObject({
    productId: uuidSchema,
    displayCurrency: currencySchema,
  }),
  handler: (input) => offeringsService.listForProduct(input.productId, input.displayCurrency),
});
