# SCR-SITE-08 — Blog post

**Route:** `/blog/[slug]` · **Render:** ISR (tag `blog:<id>`) · **App:** Site

## Purpose
Render a product's article in full at its own URL (D-804) with a persistent product card so readers can go straight to the offering. Article JSON-LD for SEO.

## User/role
Visitor, Customer.

## Entry points
Blog index, product detail blog section, landing teasers, search engines, shares.

## Layout
- **Desktop:** Breadcrumb (Blog › Title).
- Header: product chip, h1, excerpt as lede, `<time>` date, reading time.
- Cover image (21:9).
- Body in 720 px measure (Tiptap HTML: h2/h3, paragraphs, lists, images with captions, code blocks, quotes).
- Sticky right rail: `ProductCard` compact (cover, name, from-price in display currency, "View product" primary, wishlist heart) and a "Table of contents" built from h2s.
- Bottom: "Request customisation" band for the product, prev/next articles.
- Footer.
- **Phone:** rail becomes an inline product card directly under the header and again at the end; TOC omitted; body full width with 16 px gutters.

## Components
- shadcn/ui: `Breadcrumb`, `Badge`, `Card`, `Button`, `Sheet` (inquiry)
- custom: `RichText`, `ProductCardCompact`, `TableOfContents`, `PrevNextNav`.

## Content & copy notes
- Author shown as "CodeKraft" (company-brand only, D-103) — never an admin's name.
- Code blocks get a copy button.
- Product price footnote "Prices exclude taxes where applicable".

## Interactions
- TOC anchors; copy-code button; "View product" → product detail; heart → wishlist (login redirect if signed out); customisation band → `InquirySheet` (`source='product_cta'`).
- Analytics `blog_view` with product id.

## States
- **Default:** published post of a published product.
- **Loading:** static.
- **Empty:** no cover → header without image.
- **Error:** draft or product unpublished → 404.
- **Success:** wishlist/inquiry feedback as elsewhere.
- **Permission-denied:** n/a.

## Responsive behaviour
xs–md single column; lg+ two-column with sticky rail (300 px); tv measure 840 px, type +2.

## Accessibility
- `<article>` with proper heading outline; images with alt from media; code blocks `<pre><code>` with language label; TOC `nav aria-label="Article contents"`; reading time in text.

## Motion
- None beyond hover lift and rail fade-in.
- Reduced motion: none.

## Navigation
→ `/products/[slug]`, `/blog`, adjacent posts, `/auth/login`.

## Data dependencies
Tables: `T-product_blogs`, `T-slug_redirects` (301 for old slugs), `T-products`, `T-offerings`, `T-offering_prices`, `T-media`, `T-fx_rates`, `T-wishlists`, `T-leads` (write), `T-analytics_events`.
Queries: `getBlogBySlug` (API-CAT-33), `getProductBySlug` (API-CAT-31), `listBlogPosts` adjacent (API-CAT-33). Actions: `toggleWishlist` (API-CAT-35), `createLead` (API-LEAD-01, `source=product_cta`).

## Requirement IDs
D-121, D-804, D-103, D-315, A-1301, D-1302.
