# SCR-SITE-03 — Products list

**Route:** `/products` (query params `q`, `category`, `price`, `model`, `delivery`, `tech`, `industry`, `audience`, `sort`, `page`) · **Render:** SSR · **App:** Site

## Purpose
The marketplace catalog. Lets visitors search (products only, A-303), filter by category, price range, purchase model, delivery type, technology stack, industry and target audience (D-310), sort (newest, price asc/desc, most popular, featured — A-303), and open a product. Unlisted products never appear (D-314).

## User/role
Visitor, Customer (Customer additionally sees wishlist state and "Owned" markers).

## Entry points
Header "Products" + compact category panel (docs/08 §6.4), landing "Explore products", product card links, chatbot "Browse products", search from ⌘K in account.

## Layout
- **Desktop:** Page header: h1 "Products", short intro, search `Input` (full width of content column, icon, clear button) and result count "12 products".
- Left column (280 px) filter panel: `Accordion` groups — Category (two-level tree rendered as nested checkboxes, D-303), Price (dual `Slider` in display currency + min/max inputs), Purchase model (One-time, Subscription, Custom quote), Delivery type (SaaS/hosted, Download, License, Product + service, Custom), Tech stack, Industry, Target audience (checkbox lists with "Show more").
- "Clear all" at the top of the panel.
- Right column: toolbar with active filter chips (removable), sort `Select`, view toggle (grid/list); product grid 3-up: cover image (16:10), category chip, name, one-line short description, price block ("From ₹X" / strike-through compare-at + sale price / "Custom quote"), badges (Featured, Coming soon, New version), wishlist heart, and "Owned" tick for entitled customers.
- Pagination at bottom (25/page).
- **Phone:** search stays at top; "Filters (3)" button opens a full-screen `Drawer` with the same accordion groups and a sticky "Show 12 products" footer; sort is a `Select` in the toolbar; grid 1-up (2-up at sm); chips scroll horizontally.

## Components
- shadcn/ui: `Input` (search), `Accordion`, `Checkbox`, `Slider`, `Select`, `Badge`, `Card`, `Button`, `Drawer`/`Sheet`, `Pagination`, `Skeleton`, `ToggleGroup` (grid/list), `Tooltip` (converted price)
- custom: `ProductCard`, `FilterChip`, `PriceBlock`.

## Content & copy notes
- Intro copy from `site_settings.products_intro`.
- Empty search copy: "No products match “xyz” — try fewer filters or browse all." Coming-soon cards say "Coming soon" instead of a price and expose "Notify me" (adds to wishlist).
- Prices are tax-exclusive; a footnote "Prices exclude taxes where applicable" appears under the grid (BR-08, D-519).
- No ownership/partner data (D-116).
- Sort labels: "Newest", "Price: low to high", "Price: high to low", "Most popular", "Featured".

## Interactions
- Search submits on Enter or after 400 ms debounce; updates URL (`?q=`), SSR re-render via router navigation; no type-ahead.
- Every filter change updates the URL immediately on desktop; on phone changes apply on "Show N products".
- Sort change replaces `sort` param; "Most popular" uses `analytics_events` product views + paid counts over 90 days.
- Card click → product detail; heart toggles wishlist (`toggleWishlist` (API-CAT-35)) with optimistic UI; signed-out → login with `returnTo`.
- Category panel in the header deep-links to `?category=`.
- List view shows the same cards as rows with description clamp-2 and tech-stack chips.

## States
- **Default:** published, listed products ordered by sort; page 1.
- **Loading:** route `loading.tsx` renders 6 skeleton cards + skeleton filter panel; toolbar stays interactive.
- **Empty:** no results → empty state with "Clear filters" and "Start a project" links; catalog empty → "Products coming soon" band with inquiry CTA.
- **Error:** search backend error → `Alert` "Search is temporarily unavailable — showing all products" and unfiltered list.
- **Success:** wishlist toast "Saved to wishlist" with "View wishlist" action.
- **Permission-denied:** n/a.

## Responsive behaviour
xs: 1 column, drawer filters; sm: 2 columns; md: 2 columns + drawer; lg: sidebar filters + 3 columns; xl/2xl: 3–4 columns; tv: 4 columns, larger cards, sidebar 320 px, targets ≥ 56 px.

## Accessibility
- Filter panel is `<aside aria-label="Filters">`; result count is an `aria-live="polite"` region; sliders have `aria-valuetext` in currency; chips are buttons with "Remove filter: Fintech".
- Cards have a single link wrapping the name with the image `alt`; heart button labelled "Add to wishlist"/"Remove from wishlist" with `aria-pressed`.
- Pagination uses `nav aria-label="Pagination"` and `aria-current`.
- Drawer traps focus.

## Motion
- Card hover lift 200 ms (fine pointer only); grid re-render cross-fade 150 ms; drawer slide 250 ms. **Reduced motion:** no lift, no cross-fade, drawer instant.

## Navigation
→ `/products/[slug]`, `/auth/login?returnTo=/products…`, `/account/wishlist` (toast action), `/contact`.

## Data dependencies
Tables: `T-products` (search_vector, flags, status), `T-categories`, `T-tags`/`T-product_tags`, `T-offerings`, `T-offering_prices`, `T-offering_payment_methods` (not shown), `T-product_media`/`T-media`, `T-fx_rates`, `T-wishlists`, `T-entitlements` (owned marker), `T-analytics_events` (popularity, `product_view` not fired here).
Queries: `listProducts` (API-CAT-30), `listFilterFacets` (API-CAT-32), `listCategories` (API-CAT-32), `listMyWishlist` (API-CAT-36), `listMyEntitlements` (API-DEL-01). Actions: `toggleWishlist` (API-CAT-35).

## Requirement IDs
D-303, D-310, D-311, D-314, D-408, D-502, D-518, D-519, A-303, A-304, D-116, BR-08, D-1302.
