/**
 * Offerings read-only queries (docs/06 §1.3, SA-07, PHASE-03 P3.7).
 */
import { z } from "zod";
import { definePublicAction } from "@/lib/actions";
import { currencySchema, uuidSchema } from "@/modules/_shared/zod";
import type { RequestContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { offeringsService } from "./service";
import type { Money } from "@/lib/money";

export const listOfferingsForProductQuery = definePublicAction({
  name: "API-CAT-03 listOfferingsForProduct",
  input: z.strictObject({
    productId: uuidSchema,
    displayCurrency: currencySchema,
  }),
  handler: (input) => offeringsService.listForProduct(input.productId, input.displayCurrency),
});

export interface PublishedOfferingOption {
  id: string;
  label: string;
  price: Money;
  oneTime: boolean;
}

/** Active, priced offerings (INR view) of published products — the admin "pick an offering" lists. */
export async function listPublishedProductOfferingOptions(
  ctx: RequestContext,
): Promise<PublishedOfferingOption[]> {
  const products = await catalogService.listProductsAdmin(ctx, { limit: 100 });
  const lists = await Promise.all(
    products.items
      .filter((p) => p.status === "published" && p.offeringCount > 0)
      .map((p) => offeringsService.listForProduct(p.id, "INR")),
  );
  return lists.flat().flatMap((o) =>
    o.status === "active" && o.price !== null
      ? [
          {
            id: o.id,
            label: o.name,
            price: o.price.base,
            oneTime: o.purchaseModel === "one_time",
          },
        ]
      : [],
  );
}
