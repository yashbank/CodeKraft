# SCR-SITE-04 — Product detail

**Route:** `/products/[slug]` · **Render:** ISR (tag `product:<id>`; `noindex` if unlisted) · **App:** Site

## Purpose
The conversion page for one product: media, description, offerings with prices, features/benefits/audience/use cases/tech/requirements, FAQs, curated testimonials, version + public changelog, inline presentation viewer, optional live demo, the product's blog article, and the "Request customisation" lead CTA (D-315). Buy requires login and a verified email (BR-03, D-1201).

## User/role
Visitor, Customer. Customer sees wishlist state, "You own this" and renewal hints.

## Entry points
Products list, landing featured cards, blog post product card, wishlist, purchases (product snapshot), search engines/OG shares, chatbot answers (links), custom-quote pages.

## Layout
- **Desktop:** Breadcrumb (Products › Category › Name).
- Two columns: left (60 %) media gallery (main 16:10 image, thumbnails strip incl. screenshots, gallery, video embed/file, presentation thumbnail); right (40 %) sticky summary card: category chip + badges (Featured, Coming soon, Version 2.3), h1, short description, **Offering selector** (radio cards, one per active offering: name, purchase model label, billing interval, price in display currency with strike-through compare-at, "≈ charged in INR" footnote, license type, access period "Lifetime"/"12 months", trial "14-day trial" if set), price summary, primary "Buy now" (or "Request a quote" for custom_quote offerings, or "Coming soon" disabled, or "You own this → Open in dashboard"), secondary "Request customisation", wishlist heart, tiny "Prices exclude taxes where applicable" and "Refundable"/"Non-refundable" line from `is_refundable`.
- Below, full width `Tabs` (Overview · Features · FAQs · Changelog · Presentation) — each also rendered as stacked sections for SEO with tabs acting as anchors: Overview (rich description, benefits, target audience, use cases, industry chips, tech stack chips, requirements), Features (list), Testimonials (2–3 quote cards, curated, D-312), FAQs (`Accordion`), Changelog (version list with dates and rich notes, D-313), Presentation (inline PDF viewer with page controls + "Download PDF", D-805), Live demo (button "Try live demo ↗" if `live_demo_url`).
- Then **Blog section**: if the product has a published blog, one designed `BlogTeaserCard`: cover, title, excerpt, reading time, "Read the full article" → `/blog/[slug]`. The article body is **not** embedded (card + link only, avoiding duplicate content — MASTER_SPEC §7 "Blog on product page", D-121, D-804).
- Then "Request customisation" band repeating the CTA.
- Footer.
- **Phone:** breadcrumb collapses to "‹ Products"; gallery is a swipe carousel with dots; summary card follows in flow; a **sticky bottom bar** shows selected offering price + "Buy now"; tabs become an `Accordion`; presentation viewer opens full screen.

## Components
- shadcn/ui: `Breadcrumb`, `Carousel`, `Badge`, `RadioGroup` (offering cards), `Button`, `Tabs`/`Accordion`, `Card`, `Tooltip`, `Sheet` (customisation inquiry), `Dialog` (presentation full-screen), `Skeleton`, `Toast`
- custom: `MediaGallery`, `OfferingSelector`, `PriceBlock`, `PdfViewer` (pdf.js), `ChangelogList`, `TestimonialCard`, `BlogTeaserCard`, `StickyBuyBar`.

## Content & copy notes
- Purchase model labels: "One-time purchase", "Subscription · monthly/quarterly/annual", "Custom quote".
- Delivery hint per offering: "Delivered as: Download / License key / Hosted account / Product + onboarding service / Custom".
- Update policy line: "All future updates included" / "Updates during your access period" / "Major versions sold separately" (D-604).
- Never show partner or ownership (BR-02).
- No related products, no ratings (X-007, X-008).
- Coming soon: "Coming soon — add to wishlist to be notified".

## Interactions
- Offering radio changes price, delivery hint and Buy target (`/checkout/[offeringId]`, MASTER_SPEC §7 "Auth and checkout URLs").
- Buy now: signed-out → `/auth/login?returnTo=/products/slug?offering=id`; unverified → checkout interstitial; already owned one-time → button replaced (BR-10); subscription owned → "Manage subscription".
- Request customisation → `InquirySheet` with `source='product_cta'`, `product_id`, subject prefilled "Customisation for <Product>"; creates a lead (D-315, D-704).
- Request a quote (custom_quote offering) → same sheet with `offering_id`, copy "Tell us your requirements; we'll send a private quote."
- Wishlist heart optimistic toggle. Live demo opens in new tab (`rel="noopener"`). Presentation: prev/next page, zoom, full screen, download. Video embed loads on click (facade) to protect LCP. Analytics `product_view` on mount, `wishlist_add`, `checkout_start` on Buy.

## States
- **Default:** published product with ≥ 1 active offering.
- **Loading:** ISR static; client islands (wishlist, owned state) hydrate with skeleton hearts.
- **Empty:** no testimonials/FAQs/changelog/presentation/blog → their tabs/sections are omitted; no media → branded placeholder cover.
- **Error:** PDF load failure → "Couldn't load the presentation" + download link; inquiry failure inline.
- **Success:** wishlist toast; inquiry sheet success view.
- **Permission-denied:** unpublished/archived → 404 (SCR-SITE-11); unlisted renders normally with `noindex`.

## Responsive behaviour
xs–sm: single column, carousel, sticky buy bar, accordion sections. md: gallery + summary side by side (50/50), tabs. lg+: 60/40 with sticky summary. 2xl/tv: gallery max 960 px, summary 480 px, type scale up, PDF viewer height 80vh.

## Accessibility
- Gallery thumbnails are buttons with `aria-pressed`; carousel exposes prev/next buttons and slide count.
- Offering radios are a `radiogroup` labelled "Choose an offering", each with price in its accessible name.
- Sticky bar duplicates the Buy button — the in-flow one gets `aria-hidden` when the sticky one is visible to avoid double tab stops.
- PDF viewer controls are real buttons; "Download PDF" always available.
- Tabs are Radix tabs; on phone the accordion keeps heading levels (`h2`).
- Live demo link announces "opens in new tab".
- Video facade has a labelled play button.

## Motion
- Gallery cross-fade 200 ms; summary card fades in; sticky bar slides up when the in-flow Buy button leaves the viewport (200 ms); tab content cross-fade 150 ms. **Reduced motion:** instant gallery switch, sticky bar appears without slide, no fades.

## Navigation
→ `/checkout/[offeringId]`, `/auth/login`, `/blog/[slug]`, `/products?category=`, `/account/purchases/[id]` ("Open in dashboard"), external live demo, `/contact`. An old slug 301s here via `slug_redirects`.

## Data dependencies
Tables: `T-products`, `T-slug_redirects` (301 for old slugs), `T-categories`, `T-product_media` (`alt`)/`T-media` (`blur_hash`), `T-offerings`, `T-offering_prices`, `T-product_versions`, `T-product_faqs`, `T-product_testimonials`, `T-product_blogs` (teaser only), `T-fx_rates`, `T-wishlists`, `T-entitlements` + `T-user_offering_purchases` (owned), `T-leads` (write), `T-analytics_events`.
Queries: `getProductBySlug` (API-CAT-31; includes offerings, media and the blog teaser), `listMyWishlist` (API-CAT-36), `listMyEntitlements` (API-DEL-01). Actions: `toggleWishlist` (API-CAT-35), `createLead` (API-LEAD-01, `source=product_cta`), `trackEvent` (API-OPS-01).

## Requirement IDs
D-121, D-304, D-309, D-312, D-313, D-314, D-315, D-404, D-405, D-408, D-415, D-503, D-519, D-604, D-605, D-804, D-805, BR-02, BR-03, BR-08, BR-10, A-301, A-1301, X-006, X-007, X-008, D-1302.
