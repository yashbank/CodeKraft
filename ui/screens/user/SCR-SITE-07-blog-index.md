# SCR-SITE-07 — Blog index

**Route:** `/blog` · **Render:** ISR (tag `blog`) · **App:** Site

## Purpose
Index of product blogs — one article per product, no company-level posts (D-804, X-009). Each teaser links to `/blog/[slug]` and to its product. Supports SEO discovery of products through long-form content.

## User/role
Visitor, Customer.

## Entry points
Header "Blog", landing "From the blog" teasers, product detail blog section ("All articles"), footer.

## Layout
- **Desktop:** h1 "Blog", intro line "Deep dives into the products we build." Optional category chip filter (product categories that have blogs).
- Featured (latest) article as a wide card: cover 21:9, product chip, title, excerpt, date.
- Below, grid 3-up of `BlogTeaserCard`: cover 16:9, product chip, title, excerpt (clamp 3), published date, "Read" link; each card also has a small "View product →" secondary link.
- Pagination (12/page).
- Footer.
- **Phone:** featured card stacks; grid 1-up; chips scroll.

## Components
- shadcn/ui: `Badge` chips, `Card`, `Pagination`, `Skeleton`
- custom: `BlogTeaserCard`, `FeaturedArticleCard`.

## Content & copy notes
- Only `product_blogs.status='published'` whose product is published (and not unlisted).
- Excerpt from `excerpt` or first 160 chars of body.
- Date format "24 Sep 2026".
- Empty: "No articles yet."

## Interactions
- Chip filters by product category (`?category=`), server-side.
- Card click → post; "View product" → product detail.

## States
- **Default:** newest first.
- **Loading:** skeleton featured + 6 cards.
- **Empty:** message + link to `/products`.
- **Error:** static; none.
- **Success:** n/a.
- **Permission-denied:** n/a.

## Responsive behaviour
xs 1 col, md 2, lg 3, tv 4 with larger covers.

## Accessibility
- `<ul>` grid, links wrap titles, dates in `<time datetime>`, chips are toggle buttons, pagination nav labelled.

## Motion
- Card hover lift; none under reduced motion.

## Navigation
→ `/blog/[slug]`, `/products/[slug]`, `/products`.

## Data dependencies
Tables: `T-product_blogs`, `T-products`, `T-categories`, `T-media`.
Queries: `listBlogPosts` (API-CAT-33).

## Requirement IDs
D-121, D-804, X-009, A-1301.
