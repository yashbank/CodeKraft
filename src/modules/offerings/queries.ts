/**
 * `offerings` read models. Admin read of a product's offerings with prices resolved to a display
 * currency (the block API-CAT-19 / API-CAT-31 embed). Read-only, never audited.
 */
import { z } from "zod";
import { defineAction } from "@/lib/actions/envelope";
import { currencySchema, uuidSchema } from "@/modules/_shared/zod";
import { offeringsService } from "./service";

export const listProductOfferingsSchema = z.strictObject({
  productId: uuidSchema,
  displayCurrency: currencySchema.default("INR"),
});

/** Offerings of one product with prices, methods and the display-currency resolution (`catalog.read`). */
export const listProductOfferings = defineAction({
  name: "API-CAT-19 offering.list",
  input: listProductOfferingsSchema,
  permission: "catalog.read",
  handler: (input) => offeringsService.listForProduct(input.productId, input.displayCurrency),
});
