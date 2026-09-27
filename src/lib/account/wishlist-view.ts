/**
 * View-model mapper for the customer Wishlist screen (SCR-ACC-07) --
 * `modules/catalog`'s `WishlistProductCard` (from `listMyWishlist`) ->
 * `components/account/types.ts`'s `WishlistItem`.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `fromPrice` is always `undefined` -- `listMyWishlist` hard-codes `fromPrice: null` on every
 *    row (it doesn't join `offering_prices`); until that's computed there, no price can be shown.
 *  - `owned`, `unavailable`, `priceDropped`, `newVersion` are always `undefined` -- none of these
 *    have a backing computation in `listMyWishlist` (they'd need an ownership/entitlement join,
 *    a `products.status` check, and price/version-history tracking respectively). The screen's
 *    "You own this" / "No longer available" / "Price dropped" / "New version" badges simply don't
 *    render rather than showing fabricated state.
 *  - `customQuote` is always `undefined` -- `ProductCard` carries no "requires a custom quote"
 *    flag.
 */
import type { WishlistItem } from "@/components/account/types";
import type { WishlistProductCard } from "@/modules/catalog/types";

export function mapWishlistItem(card: WishlistProductCard): WishlistItem {
  return {
    id: card.productId,
    productName: card.name,
    category: card.category?.name ?? "Uncategorised",
    productHref: `/products/${card.slug}`,
    fromPrice: card.fromPrice ?? undefined,
    comingSoon: card.isComingSoon,
    addedAt: card.addedAt,
  };
}
