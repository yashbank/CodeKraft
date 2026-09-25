/**
 * Search contracts — docs/06 API-CAT-30 public `listProducts` (filter / sort / pagination),
 * API-CAT-32 `listFilterFacets`, docs/06 §1.8. Visibility: `status='published'` and not
 * `is_unlisted` (D-314). Price filters are in the display currency, converted via `fx_rates`.
 */
import { z } from "zod";
import type { Context } from "@/lib/authz/context";
import type { DbOrTx } from "@/lib/db";
import {
  type ListResult,
  currencySchema,
  cursorSchema,
  limitSchema,
  slugSchema,
  text,
} from "../catalog/contracts";
import type { ProductCard } from "../catalog/types";
import { deliveryTypeSchema, purchaseModelSchema } from "../offerings/contracts";
import { PRODUCT_SORTS, PRODUCT_SORT_DEFAULT, type FilterFacets } from "./types";

export const productSortSchema = z.enum(PRODUCT_SORTS);

/** API-CAT-30 `filters` (D-310). */
export const productFiltersSchema = z
  .strictObject({
    categorySlug: slugSchema.optional(),
    /** Minor units in the display currency. */
    priceMin: z.number().int().nonnegative().optional(),
    priceMax: z.number().int().nonnegative().optional(),
    purchaseModel: purchaseModelSchema.optional(),
    deliveryType: deliveryTypeSchema.optional(),
    techStack: z.array(text(60)).max(10).optional(),
    industry: z.array(text(60)).max(10).optional(),
    targetAudience: z.array(text(60)).max(10).optional(),
  })
  .refine((f) => f.priceMin === undefined || f.priceMax === undefined || f.priceMin <= f.priceMax, {
    message: "priceMin must not exceed priceMax",
    path: ["priceMax"],
  });
export type ProductFilters = z.infer<typeof productFiltersSchema>;

/** API-CAT-30 `listProducts` — `q` runs `websearch_to_tsquery` over `products.search_vector`. */
export const listProductsSchema = z.strictObject({
  q: z.string().trim().max(200).optional(),
  filters: productFiltersSchema.optional(),
  sort: productSortSchema.default(PRODUCT_SORT_DEFAULT),
  cursor: cursorSchema.optional(),
  limit: limitSchema,
  displayCurrency: currencySchema,
});
export type ListProductsInput = z.infer<typeof listProductsSchema>;

/** API-CAT-32 `listFilterFacets`. */
export const listFilterFacetsSchema = z.strictObject({
  displayCurrency: currencySchema,
});

export interface SearchService {
  /** API-CAT-30 (visitor query, ISR 300 s, `T: catalog`). */
  listProducts(
    ctx: Context,
    input: ListProductsInput,
    tx?: DbOrTx,
  ): Promise<ListResult<ProductCard>>;
  /** API-CAT-32 (visitor query, `T: catalog`). */
  listFilterFacets(
    ctx: Context,
    input: z.infer<typeof listFilterFacetsSchema>,
    tx?: DbOrTx,
  ): Promise<FilterFacets>;
  /** Sitemap / OG helpers: every listed published product slug with `updatedAt`. */
  listPublishedSlugs(tx?: DbOrTx): Promise<{ slug: string; updatedAt: string }[]>;
}
