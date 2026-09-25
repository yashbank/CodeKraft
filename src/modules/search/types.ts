/**
 * Search domain types — docs/06 API-CAT-30 (`listProducts`), API-CAT-32 (`listFilterFacets`),
 * docs/04 §7.8 (`products.search_vector`, `websearch_to_tsquery`), D-310, A-303, A-304.
 */
import type { DeliveryTypeValue, PurchaseModelValue } from "../offerings/types";

export const PRODUCT_SORTS = ["newest", "price_asc", "price_desc", "popular", "featured"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export const PRODUCT_SORT_DEFAULT: ProductSort = "featured";

/** Rolling window for the `popular` sort (`analytics_events` product views + orders). */
export const POPULAR_WINDOW_DAYS = 30;

export interface FacetValue<V extends string = string> {
  value: V;
  label: string;
  count: number;
}

/** API-CAT-32 `listFilterFacets` — value counts over published, listed products. */
export interface FilterFacets {
  categories: (FacetValue & { slug: string; parentSlug: string | null })[];
  purchaseModels: FacetValue<PurchaseModelValue>[];
  deliveryTypes: FacetValue<DeliveryTypeValue>[];
  techStack: FacetValue[];
  industry: FacetValue[];
  targetAudience: FacetValue[];
  /** Min/max default-offering price in the display currency (minor units). */
  priceRange: { min: number; max: number } | null;
}
