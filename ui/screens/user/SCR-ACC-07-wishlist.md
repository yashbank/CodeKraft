# SCR-ACC-07 — Wishlist

**Route:** `/account/wishlist` · **Render:** Client · **App:** Account

## Purpose
Saved products for later purchase, including coming-soon products the customer asked to be notified about (D-311, D-314). Shows current price and availability so the list stays actionable.

## User/role
Customer.

## Entry points
Sidebar "Wishlist", overview wishlist count, toast action "View wishlist" after saving from catalog, product page heart.

## Layout
- **Desktop:** h1 "Wishlist" with count.
- Grid 3-up of `ProductCard` (same as catalog) with: cover, name, category, from-price in display currency (or "Coming soon" / "Custom quote"), badges (Coming soon, New version since saved, Price dropped — compares saved-at price snapshot if available, otherwise omitted), primary "View product", secondary "Buy now" (goes to product page with default offering preselected; disabled for coming soon), remove (×) icon button.
- Sort `Select`: Recently added / Name / Price.
- **Phone:** list of compact rows: thumbnail, name, price, actions in a row.

## Components
- shadcn/ui: `Card`, `Badge`, `Button`, `Select`, `Skeleton`, `Toast` (undo)
- custom: `ProductCard`, `WishlistRow`.

## Content & copy notes
- Empty: "Your wishlist is empty — browse products and tap the heart to save them." Owned products stay listed with an "You own this" badge and "Open in dashboard".
- Unpublished/archived products show "No longer available" and a remove prompt.

## Interactions
- Remove → `toggleWishlist` (API-CAT-35) optimistic; toast with "Undo" (5 s).
- Buy now → `/products/[slug]?offering=<default>` (checkout starts from the product page so the offering choice is explicit).
- Coming-soon products: "Notify me" implicitly on — copy "We'll email you when it launches" (notification sent by product publish job).

## States
- **Default:** grid.
- **Loading:** 6 skeleton cards.
- **Empty:** as above with "Explore products".
- **Error:** `Alert` + retry.
- **Success:** remove toast with undo.
- **Permission-denied:** n/a.

## Responsive behaviour
- xs: compact rows (thumbnail 56 px, name, price, actions); remove button 44 px.
- sm–md: 2-column cards; lg–xl: 3 columns; 2xl: 3 columns with larger covers.
- tv: 4 columns, 56 px buttons, sort control enlarged, no hover-only affordances.

## Accessibility
- Grid as list; remove buttons labelled "Remove <product> from wishlist"; price changes announced only on load, not live.

## Motion
- Card removal collapse 200 ms. **Reduced motion:** instant removal.

## Navigation
→ `/products/[slug]`, `/products`, `/account/purchases/[id]`.

## Data dependencies
Tables: `T-wishlists`, `T-products`, `T-offerings`, `T-offering_prices`, `T-media`, `T-fx_rates`, `T-entitlements`.
Queries: `listMyWishlist` (API-CAT-36). Actions: `toggleWishlist` (API-CAT-35).

## Requirement IDs
D-311, D-314, D-408, D-502, D-1001, BR-02.
