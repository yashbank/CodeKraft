# 11 — SEO & PERFORMANCE

**Implements:** baseline §12 (motion, browsers), §14 (SEO), §15 (performance); MASTER_SPEC §4.10 (public pages server-rendered); A-1301, A-801, A-1402, A-1501; D-803, D-804, D-806, D-808, D-904, D-907, D-1301, D-1303, D-1304, D-1605; R-801, R-1402.
**Depends on:** `docs/04-SOLUTION-ARCHITECTURE.md` §4 (stack), §5 (routes), §6 (ISR), §7.7 (content), §7.9 (flags), §11 (portability); `docs/05-DATABASE-DESIGN.md` §2, §3, §10.
**Feeds:** `docs/10-QA-TEST-STRATEGY.md` (Lighthouse CI / axe gates), `docs/12-DEVOPS-DEPLOYMENT.md` (CI jobs, CDN), `implementation/` (P-tasks for `modules/seo`, `components/three`, `components/motion`).

Requirement IDs used below: FR-SEO-01…06, FR-OPS-03, NFR-PERF-01…06, NFR-A11Y-01 and NFR-OPS-03 are defined in `docs/03-SRS.md`; this document is the implementation contract for them. Where the SRS marks a figure "(proposed)", this document adopts it as the ceiling and may set a tighter working target.

---

## Part A — SEO

### A1. Principles

| # | Rule | Source |
|---|------|--------|
| S1 | Every public route under `(site)/` is a Server Component rendered with SSG or ISR; no public content depends on client fetches for its HTML. | A-1301, MASTER_SPEC §4.10 |
| S2 | One canonical URL per entity: product, case study, product blog each own exactly one URL (A-801). Query parameters never change indexable content. | D-803, D-804 |
| S3 | Metadata is data: `seo_title`, `seo_description`, `og_image_media_id`, `canonical_url` live on `products`, `product_blogs`, `case_studies` (T-products, T-product_blogs, DB §10); admins edit them, code only renders them. | D-1106 |
| S4 | Nothing internal leaks: partner ownership (BR-02, D-116), founder names (D-103), admin routes (A-1201), unlisted products (D-314) are never present in HTML, sitemap, JSON-LD or OG images. | BR-02, D-103, D-314 |
| S5 | Prices in HTML are rendered server-side in the base currency (INR) so crawlers and the canonical page see one price; display-currency conversion (D-502) is a client-side swap after hydration. | D-502, D-518 |
| S6 | No third-party SEO scripts, no tag manager, no GA4 (X-013 list, D-1301). | D-1301 |

### A2. Route inventory and metadata

`metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL)`; title template `%s · CodeKraft` set in `app/(site)/layout.tsx`. Each route exports `generateMetadata` (dynamic) or a static `metadata` object. `alternates.canonical` is always absolute. OG images are 1200×630, served from `/api/og/<type>/<slug>` (`next/og`, ISR-cached 24 h) unless the entity has an uploaded OG image.

| Route | Rendering / revalidate | Title source | Description source | OG image | robots | JSON-LD |
|-------|------------------------|--------------|--------------------|----------|--------|---------|
| `/` (story chapters) | ISR 300 s, tag `content` | `site_settings.seo_title` → "CodeKraft — Software studio & products" | `landing_chapters.who.subtitle` | `/api/og/site` | index, follow | Organization, WebSite |
| `/services` | ISR 3600 s, tag `content` | "Services" | first 155 chars of intro | `/api/og/site?title=Services` | index | BreadcrumbList, Service ×n (§A6) |
| `/products` | ISR 300 s, tag `catalog` | "Products" (+ category name when filtered by path) | static copy | `/api/og/site?title=Products` | index (filters via query string → canonical strips them) | BreadcrumbList, ItemList (top 20 published) |
| `/products/[slug]` | ISR 600 s, tag `product:<slug>` | `seo_title` → `name` | `seo_description` → `short_description` | `og_image_media_id` → `/api/og/product/<slug>` | index unless `is_unlisted` → `noindex, nofollow` | Product(+Offer/AggregateOffer), BreadcrumbList, FAQPage (if FAQs), VideoObject (if demo video) |
| `/projects` | ISR 3600 s, tag `content` | "Case studies" | static copy | `/api/og/site?title=Case studies` | index | BreadcrumbList, ItemList |
| `/projects/[slug]` | ISR 3600 s, tag `case-study:<slug>` | `seo_title` → `title` | `seo_description` → first 155 chars of `problem_json` text | `cover_media_id` → `/api/og/case-study/<slug>` | index | Article (CreativeWork subtype `Article`), BreadcrumbList |
| `/blog` | ISR 600 s, tag `blog` | "Blog" | static copy | `/api/og/site?title=Blog` | index | BreadcrumbList, ItemList |
| `/blog/[slug]` | ISR 3600 s, tag `blog:<slug>` | `seo_title` → `title` | `seo_description` → `excerpt` | `cover_media_id` → `/api/og/blog/<slug>` | index unless parent product `is_unlisted` → `noindex` | Article, BreadcrumbList |
| `/contact` | SSG | "Start a project" | static copy | site OG | index | BreadcrumbList, ContactPage (no phone/email — D-808) |
| `/legal/{privacy,terms,refunds,license}` | ISR 3600 s (arch §6 window), tag `content` | `legal_pages.title` | first 155 chars | site OG | index, `nofollow` not needed | BreadcrumbList |
| `/auth/login`, `/auth/register`, `/auth/verify`, `/auth/reset`, `/auth/otp` (flagged) | SSR | "Sign in" etc. | — | none | `noindex, nofollow` | none |
| `/account/*`, `/checkout/[offeringId]`, `/quote/[token]` | SSR, `dynamic` | — | — | none | `noindex, nofollow` + `X-Robots-Tag` header | none |
| `admin.<domain>/*` | SSR | — | — | none | `X-Robots-Tag: noindex, nofollow, noarchive` on every response (middleware) + `robots.txt` `Disallow: /` | none |

Twitter card on all indexable routes: `twitter: { card: 'summary_large_image', title, description, images: [og] }`. No `site`/`creator` handle (no public social links — D-808, X-011).

### A3. URL and slug rules

| Rule | Detail |
|------|--------|
| Character set | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 3–80 chars, generated from name with `slugify` (transliterate, strip stop-punctuation), editable by admin before first publish. |
| Uniqueness | `products.slug`, `product_blogs.slug`, `case_studies.slug`, `categories.slug` each `UNIQUE` (DB §2, §10). Blog slug defaults to the product slug; collisions get `-blog` suffix. |
| Renames | A published product, case study or blog slug may be changed; the old slug is written to `slug_redirects(entity, old_slug, new_slug)` (DB §2, FR-SEO-07) and middleware serves it as a **301** to the new URL, also for `/blog/<old>`; the sitemap lists only current slugs; chains are collapsed (a redirect always points at the latest slug) (MASTER_SPEC §7 "Slug changes"). |
| Paths | `/products/<slug>`, `/projects/<slug>`, `/blog/<slug>`; categories filter by query string `?category=<slug>` (canonical strips it, `ItemList` unaffected). No trailing slashes (`trailingSlash: false`), lowercase enforced by middleware 308 redirect. |
| Reserved slugs | `new`, `edit`, `admin`, `api`, `sitemap`, `robots`, `og` rejected by the Zod schema in `modules/catalog`. |
| Query params | `utm_*`, `ref`, `currency`, `theme`, `page`, `sort`, filter keys → never in canonical; `page` ≥ 2 on `/products` renders `rel="next"/"prev"` links and self-canonical per page. |
| Host | Single canonical host from `NEXT_PUBLIC_SITE_URL`; `www.` and the interim `*.vercel.app` host 308-redirect to it once the purchased domain is live (docs/12 §9). |

### A4. Sitemap and robots

`app/sitemap.ts` (framework-native, cached 1 h, regenerated on `revalidateTag('sitemap')` which every publish action calls):

| Entry | Query | `lastModified` | `changeFrequency` | `priority` |
|-------|-------|----------------|-------------------|------------|
| `/`, `/services`, `/products`, `/projects`, `/blog`, `/contact` | static | deploy time / max `updated_at` | weekly | 1.0 / 0.8 |
| `/products/<slug>` | `status='published' AND is_unlisted=false` (coming-soon **included**) | `updated_at` | weekly | 0.9 |
| `/projects/<slug>` | `case_studies.published=true` | `published_at` | monthly | 0.7 |
| `/blog/<slug>` | `product_blogs.status='published'` AND parent product published and not unlisted | `updated_at` | monthly | 0.6 |
| `/legal/*` | `legal_pages` | `published_at` | yearly | 0.3 |

Excluded: unlisted products and their blogs (D-314), draft/scheduled/unpublished/archived products (A-302), old slugs from `slug_redirects`, `/auth/*`, `/account/*`, `/checkout/*`, `/quote/*`, `/api/*`, admin host. Catalog < 50 (A-304) so a single sitemap file is enough; `generateSitemaps` sharding is not needed until 50k URLs.

`app/robots.ts`:

```
User-agent: *
Allow: /
Disallow: /account/  /checkout/  /quote/  /auth/  /api/
Sitemap: https://<domain>/sitemap.xml
```

On the admin host the middleware serves `User-agent: *\nDisallow: /` and never a sitemap. Preview deployments (docs/12) send `X-Robots-Tag: noindex` on all responses (Vercel default) and staging adds the same header via `APP_ENV=staging` check in middleware.

### A5. Unlisted, coming-soon, scheduled and archived handling

| State | Page | Sitemap | `robots` meta | JSON-LD | Notes |
|-------|------|---------|---------------|---------|-------|
| `published`, listed | 200 | yes | index | full | |
| `published`, `is_unlisted` | 200 by direct link | no | `noindex, nofollow` + `X-Robots-Tag` | Product **without** `offers`? No — same Product schema, but page is noindex so it is irrelevant; keep for consistency | Not in `/products`, search, ItemList, internal links, related teasers (D-314) |
| `published`, `is_coming_soon` | 200, no buy button | yes | index | Product with `offers` **omitted** (no purchasable offering) and `"additionalProperty": [{"name":"availability","value":"coming soon"}]` | "Notify me" CTA creates a lead (D-315) |
| `scheduled` (`publish_at` future) | 404 (or 200 for admins previewing with `?preview=<token>` → `noindex`) | no | — | — | Cron publishes at `publish_at` and calls `revalidateTag` |
| `unpublished` | 404 (`NOT_FOUND`, docs/06 API-CAT-31; customers holding an entitlement may still open it) | no | — | — | Removed from sitemap on unpublish so Google drops it |
| `archived` | 404 | no | — | — | BR-11 |
| Blog whose product is unlisted | 200 | no | noindex | Article | inherits parent visibility |

### A6. JSON-LD per page

All JSON-LD is emitted by `modules/seo/jsonld.ts` as a `<script type="application/ld+json">` in the Server Component, built from typed helpers (`schema-dts`) so a wrong property fails typecheck. `@id` values are absolute URLs. Currency is always the base currency (`site_settings.base_currency`, INR at launch — D-502, D-518); amounts are minor units ÷ 100 formatted with two decimals.

**Organization + WebSite (`/`)** — no founders (D-103), no contact points (D-808), no `sameAs` (X-011):

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://<domain>/#organization",
      "name": "CodeKraft",
      "url": "https://<domain>/",
      "logo": { "@type": "ImageObject", "url": "https://<domain>/logo-512.png", "width": 512, "height": 512 },
      "description": "CodeKraft builds software, websites and products for clients and sells its own digital products.",
      "areaServed": "Worldwide",
      "knowsAbout": ["Custom web applications", "Mobile apps", "SaaS development", "UI/UX design", "AI integration"]
    },
    {
      "@type": "WebSite",
      "@id": "https://<domain>/#website",
      "url": "https://<domain>/",
      "name": "CodeKraft",
      "publisher": { "@id": "https://<domain>/#organization" },
      "potentialAction": {
        "@type": "SearchAction",
        "target": { "@type": "EntryPoint", "urlTemplate": "https://<domain>/products?q={search_term_string}" },
        "query-input": "required name=search_term_string"
      }
    }
  ]
}
```

**Product + Offer (`/products/[slug]`)** — manual payment does not change the Offer: `availability` is `InStock` because the product is purchasable; payment method is expressed with `acceptedPaymentMethod` limited to what the offering enables (`offering_payment_methods`, D-110). Subscription offerings use `UnitPriceSpecification.billingDuration`. Custom-quote offerings (D-404) are excluded from `offers`. No `aggregateRating`/`review` ever (X-007). Example for a product with two offerings:

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "@id": "https://<domain>/products/fitdesk-pro#product",
  "name": "FitDesk Pro",
  "description": "Gym and studio management SaaS with member billing, class scheduling and trainer tools.",
  "image": ["https://media.<domain>/products/2026/09/fitdesk-hero.webp", "https://media.<domain>/products/2026/09/fitdesk-og.png"],
  "url": "https://<domain>/products/fitdesk-pro",
  "sku": "fitdesk-pro",
  "category": "SaaS > Health & Fitness",
  "brand": { "@type": "Brand", "name": "CodeKraft" },
  "manufacturer": { "@id": "https://<domain>/#organization" },
  "releaseDate": "2026-09-30",
  "additionalProperty": [{ "@type": "PropertyValue", "name": "version", "value": "2.3.0" }],
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "INR",
    "lowPrice": "1999.00",
    "highPrice": "19990.00",
    "offerCount": 2,
    "offers": [
      {
        "@type": "Offer",
        "name": "Monthly",
        "url": "https://<domain>/products/fitdesk-pro?offering=monthly",
        "priceCurrency": "INR",
        "price": "1999.00",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "1999.00",
          "priceCurrency": "INR",
          "billingDuration": "P1M",
          "priceType": "https://schema.org/ListPrice"
        },
        "availability": "https://schema.org/InStock",
        "itemCondition": "https://schema.org/NewCondition",
        "acceptedPaymentMethod": ["http://purl.org/goodrelations/v1#ByBankTransferInAdvance"],
        "seller": { "@id": "https://<domain>/#organization" },
        "eligibleRegion": "Worldwide"
      },
      {
        "@type": "Offer",
        "name": "Annual",
        "url": "https://<domain>/products/fitdesk-pro?offering=annual",
        "priceCurrency": "INR",
        "price": "19990.00",
        "priceSpecification": { "@type": "UnitPriceSpecification", "price": "19990.00", "priceCurrency": "INR", "billingDuration": "P1Y" },
        "availability": "https://schema.org/InStock",
        "itemCondition": "https://schema.org/NewCondition",
        "acceptedPaymentMethod": ["http://purl.org/goodrelations/v1#ByBankTransferInAdvance"],
        "seller": { "@id": "https://<domain>/#organization" }
      }
    ]
  }
}
```

Rules: single offering → a plain `Offer` instead of `AggregateOffer`; `compare_at_minor` (D-408) → `price` is the sale price and the struck-through amount is not emitted (Google ignores it); `is_refundable` → `hasMerchantReturnPolicy` with `returnPolicyCategory: MerchantReturnNotPermitted` when false, `MerchantReturnFiniteReturnWindow` is **not** claimed when true (refund is admin-discretionary, BR-09) — emit `MerchantReturnUnspecified`. Tax: prices are tax-exclusive (BR-08); `valueAddedTaxIncluded: false` on each Offer.

**Article (`/blog/[slug]`, `/projects/[slug]`)** — author is always the Organization (D-103):

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": "https://<domain>/blog/fitdesk-pro#article",
  "headline": "How FitDesk Pro handles 3,000 members without a spreadsheet",
  "description": "Excerpt of the product blog (≤ 160 chars).",
  "image": ["https://media.<domain>/blog/2026/09/fitdesk-cover.webp"],
  "datePublished": "2026-10-02T08:00:00+05:30",
  "dateModified": "2026-10-05T10:15:00+05:30",
  "author": { "@id": "https://<domain>/#organization" },
  "publisher": { "@id": "https://<domain>/#organization" },
  "mainEntityOfPage": "https://<domain>/blog/fitdesk-pro",
  "about": { "@id": "https://<domain>/products/fitdesk-pro#product" },
  "isPartOf": { "@id": "https://<domain>/#website" },
  "inLanguage": "en"
}
```

Case studies use the same shape with `"@type": "Article"`, `about` omitted, and `keywords` = `tech_stack` + `industry`.

**BreadcrumbList (every indexable page below `/`)**:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://<domain>/" },
    { "@type": "ListItem", "position": 2, "name": "Products", "item": "https://<domain>/products" },
    { "@type": "ListItem", "position": 3, "name": "FitDesk Pro" }
  ]
}
```

Category crumbs (`Products › SaaS › FitDesk Pro`) are added only when the product has a category; the category item links to `/products?category=<slug>`.

**FAQPage (product FAQs, `product_faqs`)** — emitted only when ≥ 2 published FAQs; answers are the plain-text rendering of `answer_json` (Tiptap → text, HTML stripped). Google restricts FAQ rich results to a few site classes since 2023, so this is for semantics, not for a rich result:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://<domain>/products/fitdesk-pro#faq",
  "mainEntity": [
    { "@type": "Question", "name": "Does FitDesk Pro work offline?",
      "acceptedAnswer": { "@type": "Answer", "text": "No. FitDesk Pro is hosted SaaS and needs an internet connection." } },
    { "@type": "Question", "name": "How is it delivered after payment?",
      "acceptedAnswer": { "@type": "Answer", "text": "After CodeKraft confirms your UPI or bank transfer, we create your account and email the credentials, usually within one business day." } }
  ]
}
```

**Service (`/services`)** — one `Service` node per row in `services` (D-302, D-806), no `offers` (BR-01, no service pricing):

```json
{ "@type": "Service", "@id": "https://<domain>/services#custom-web-apps", "name": "Custom web applications",
  "serviceType": "Software development", "provider": { "@id": "https://<domain>/#organization" },
  "description": "…", "areaServed": "Worldwide", "url": "https://<domain>/services#custom-web-apps" }
```

**VideoObject** on product pages with a demo video (D-309): `name`, `description`, `thumbnailUrl` (poster), `uploadDate`, `embedUrl` (YouTube/Vimeo) or `contentUrl` (self-hosted R2 URL), `duration` from `media.duration_s`.

### A7. Content rules the admin UI enforces

| Field | Rule (Zod, `modules/catalog`, `modules/content`) |
|-------|--------------------------------------------------|
| `seo_title` | 30–60 chars; defaults to `name`; template appends ` · CodeKraft` (total ≤ 70). |
| `seo_description` | 70–160 chars; defaults to `short_description` trimmed at a word boundary. |
| Headings | Exactly one `<h1>` per page (product name / article title / chapter title on `/`); Tiptap heading levels in rich text are shifted so body content starts at `<h2>`. |
| Image alt | Required non-empty string, ≤ 125 chars, stored in `product_media.alt` (DB §2, FR-CONT-08) for every product image and on every rich-text image node; decorative images (backgrounds, gradients) use `alt=""` and are never uploaded through the product media UI. |
| OG image | 1200×630, ≤ 300 KB, PNG/JPEG/WebP; generated fallback always exists. |
| Blog on product page | Rendered as a **card** (cover, title, excerpt, "Read the article") linking to `/blog/<slug>` (D-121 "designed cards"); the full article body exists only at its own URL so there is no duplicate content between `/products/<slug>` and `/blog/<slug>` (D-804). |
| Legal pages | Plain semantic HTML, `<article>` with `<time datetime>` for version date. |

### A8. Internal linking plan

| From | To | Mechanism |
|------|----|-----------|
| `/` chapter "What we build" | `/services`, `/contact` | chapter CTA (`landing_chapters.cta`) |
| `/` chapter "What we sell" | `/products`, each `featured_products` → `/products/<slug>` | server-rendered cards (D-314 featured) |
| `/` chapter "Proof" | 3 latest `case_studies` → `/projects/<slug>`, 3 latest blog teasers → `/blog/<slug>` | D-804, D-117 |
| Header nav (all pages) | `/services`, `/products`, `/projects`, `/blog`, `/contact` | `<nav aria-label="Primary">` |
| Footer (all pages) | all top-level routes + `/legal/*`; no email/phone/social (D-808) | `<nav aria-label="Footer">` |
| `/products/<slug>` | category listing, `/blog/<slug>` card, `/contact?product=<slug>` ("Request customisation" D-315), changelog anchor `#changelog` (D-313) | No related-products block (X-008) |
| `/blog/<slug>` | parent `/products/<slug>` (prominent CTA above and below the article) | D-804 |
| `/projects/<slug>` | `/contact` ("Start a similar project"), `/services#<service-slug>` for each service used | |
| Breadcrumbs | on every page below `/`, visually and as BreadcrumbList | |

Orphan check: an integration test asserts every sitemap URL is reachable from `/` within 3 link hops.

### A9. Analytics for SEO (no cookies)

Umami (D-1301, A-1501) records page views with `data-auto-track` and the custom events from D-1302 via `umami.track()`. Referrer and UTM are kept by Umami; nothing SEO-related is stored in `analytics_events` except `web_vital` rows (§B9). Search Console and Bing Webmaster are verified by the DNS TXT record once the domain exists (docs/12 §5); until then the `*.vercel.app` host is verified by the HTML meta tag from `site_settings.search_console_token`.

---

## Part B — Performance

### B1. Targets (D-1303) and device baseline

| Metric | Target (p75, field) | Lab gate (Lighthouse CI, mobile) | Applies to |
|--------|---------------------|----------------------------------|------------|
| LCP | < 2.5 s | ≤ 2.5 s | every public route incl. `/` with 3D hero |
| INP | < 200 ms | TBT ≤ 300 ms (lab proxy) | every route incl. `/account/*` and admin |
| CLS | < 0.1 | ≤ 0.1 | every public route |
| TTFB | < 800 ms | ≤ 800 ms | ISR-served routes (cache HIT) |
| Lighthouse Performance | — | ≥ 85 on `/`, ≥ 90 elsewhere | public routes |
| Accessibility (Lighthouse + axe) | — | ≥ 95, zero axe "serious/critical" | all routes (D-907) |

Reference device: Lighthouse "Moto G Power" emulation, 4× CPU slowdown, slow-4G throttling (1.6 Mbps / 150 ms RTT). Browser matrix: last 2 versions of Chrome, Edge, Firefox, Safari desktop + iOS Safari (D-1304); `browserslist` = `last 2 versions, not dead, iOS >= 16`.

### B2. Byte budgets per page type (compressed, gzip — the unit NFR-PERF-02/03 use; brotli on the wire is ≈ 15 % smaller)

| Page type | Initial JS (route + shared) | Deferred JS allowed | CSS | Fonts | Images above fold | Total above-fold transfer | Notes |
|-----------|-----------------------------|---------------------|-----|-------|--------------------|---------------------------|-------|
| `/` story landing | ≤ 200 KB (NFR-PERF-02 ceiling; target 180 KB) | 3D bundle ≤ 600 KB (NFR-PERF-03 ceiling; target 400 KB) after LCP, desktop only; GSAP+ScrollTrigger+Lenis ≤ 60 KB (after hydration) | ≤ 45 KB | ≤ 120 KB | hero poster ≤ 150 KB (desktop), ≤ 90 KB (mobile) | ≤ 700 KB mobile / ≤ 1.5 MB desktop incl. 3D | R-801 |
| `/products`, `/projects`, `/blog` lists | ≤ 140 KB | filter UI ≤ 30 KB | ≤ 40 KB | shared | first 4 cards ≤ 60 KB each | ≤ 500 KB | |
| `/products/[slug]` | ≤ 160 KB | gallery lightbox ≤ 40 KB, PDF viewer ≤ 350 KB (on demand), video facade → iframe on click | ≤ 40 KB | shared | hero image ≤ 120 KB | ≤ 600 KB | D-805, D-309 |
| `/projects/[slug]`, `/blog/[slug]` | ≤ 130 KB | lightbox | ≤ 40 KB | shared | cover ≤ 120 KB | ≤ 500 KB | |
| `/services`, `/contact`, `/legal/*` | ≤ 120 KB | Turnstile (lazy, ~30 KB) | ≤ 35 KB | shared | ≤ 80 KB | ≤ 400 KB | |
| `/account/*` | ≤ 220 KB | TanStack Query, charts none | ≤ 45 KB | shared | — | — | INP only |
| `admin.<domain>/*` | ≤ 350 KB | react-grid-layout, Recharts, Tiptap, TanStack Table loaded per screen | ≤ 60 KB | shared | — | — | INP ≤ 200 ms; not in LHCI public gate |

Shared framework baseline (React 19 + Next runtime ≈ 90 KB) counts inside "Initial JS". Budgets are enforced by `size-limit` in CI (docs/12 §4) with a 10 % tolerance; a PR that exceeds a budget fails.

### B3. Fonts (`next/font`)

| Rule | Detail |
|------|--------|
| Loading | `next/font/google` (self-hosted at build, zero external requests) or `next/font/local` for licensed files; both themes' pairings (docs/08) are declared once in `app/layout.tsx` and exposed as CSS variables `--font-display`, `--font-body`. |
| Count | ≤ 2 families, ≤ 4 files total (display 600/700, body 400/500); variable fonts preferred. Theme 2's serif display (D-903) is loaded only when `theme_light_editorial` is on and the active theme is Theme 2 (V1.1). |
| Subset | `subsets: ['latin']`, `display: 'swap'`, `adjustFontFallback: true` (size-adjusted fallback → no CLS). |
| Preload | `next/font` injects `<link rel="preload">` for the display font only; body font not preloaded on mobile. |
| Icons | `lucide-react` tree-shaken; no icon fonts. |

### B4. Images (`next/image`)

| Rule | Detail |
|------|--------|
| Source | All uploads go to R2 (DB T-media); `next.config.ts` `images.remotePatterns` allows `media.<domain>` (R2 custom domain) and the interim `*.r2.dev` host; `formats: ['image/avif','image/webp']`; `deviceSizes` trimmed to `[640, 768, 1024, 1280, 1536, 1920]`; `minimumCacheTTL: 86400`. |
| Upload caps (admin) | image ≤ 10 MB (FR-CONT-06), ≤ 4096 px longest side, MIME allow-list `image/{jpeg,png,webp,avif,gif,svg+xml}`; the admin UI warns above 2 MB because `next/image` re-encodes on demand and large originals slow the first optimisation; SVG only for logos and served with `Content-Disposition: attachment` unless sanitised (docs/09). Server records width/height (T-media) so `<Image>` always has dimensions → no CLS. |
| LCP element | Exactly one `priority` image per page (hero poster on `/`, primary product image, cover on articles); `fetchPriority="high"`, `sizes` mandatory on every `<Image>` (`(max-width: 768px) 100vw, 50vw` patterns from docs/08). |
| Everything else | `loading="lazy"` (default), gallery uses thumbnails ≤ 40 KB and loads full size in the lightbox. |
| OG images | `next/og` route, `runtime = 'nodejs'` (portability, arch §11), cached `Cache-Control: public, max-age=86400, s-maxage=604800, stale-while-revalidate`. |
| Placeholders | `placeholder="blur"` with a 10-px `blurDataURL` derived from `media.blur_hash`, computed server-side when the upload is completed (DB §2, docs/06 §3.5) for hero/cover images. |
| On a VPS | Built-in optimizer (sharp) runs in-process; cache directory on a volume (docs/12 §9). |

### B5. Video (A-1402, R-1402, D-309)

| Path | Rule |
|------|------|
| Embed (primary) | YouTube/Vimeo via a **facade**: server-rendered poster (`https://i.ytimg.com/vi/<id>/hqdefault.jpg` proxied through `next/image`) + play button; the iframe (`youtube-nocookie.com` / `player.vimeo.com?dnt=1`) is injected on click. Zero third-party bytes before interaction. |
| Self-hosted (optional) | MP4 (H.264/AAC) or WebM, ≤ 200 MB per file (FR-CONT-06 ceiling; admin UI recommends ≤ 50 MB / 1080p / 3 min because there is no transcoding until V2). Admin must upload a poster (required field). `<video preload="metadata" poster controls playsInline>` with no autoplay; served from the R2 public bucket with `Cache-Control: public, max-age=31536000, immutable`. Cap: 2 GB of video across the catalog (NFR-OPS-03); admin storage widget warns at 70 % of the R2 free 10 GB. |
| Never | Background/autoplay video in chapters; video as LCP element. |

### B6. 3D hero (D-904, D-1605, D-907, feature flag `three_hero`)

| Aspect | Rule |
|--------|------|
| Poster first | The hero's LCP element is a static AVIF/WebP poster exported from the scene (≤ 150 KB desktop, ≤ 90 KB mobile), rendered server-side with `priority`. The canvas is layered above it and fades in after its first frame; the poster stays in the DOM so a failed load is invisible to the user. |
| Gating (client, before any import) | All must be true: flag `three_hero` on; `matchMedia('(prefers-reduced-motion: no-preference)')`; viewport ≥ 1024 px **and** not a touch-primary device (`(hover: hover) and (pointer: fine)`) — mobile never gets 3D (D-907); `navigator.connection?.saveData !== true` and effectiveType not `2g/3g`; `navigator.deviceMemory ≥ 4` (when reported) and `hardwareConcurrency ≥ 4`; WebGL2 context creatable; document visible. Fails → poster only, no bytes downloaded. |
| Load timing | `dynamic(() => import('@/components/three/HeroScene'), { ssr: false })` triggered by `onLCP` callback from `web-vitals` (or `window.load + 1500 ms` fallback, whichever first) then `requestIdleCallback`. Never in the initial route chunk. |
| Bundle | `three` (named imports only, no `three/examples` barrel), `@react-three/fiber`, `@react-three/drei` (named imports) — JS ≤ 400 KB gzip target, 600 KB ceiling (NFR-PERF-03); scene assets separately ≤ 1.5 MB: glTF with Draco/meshopt compression, textures KTX2 ≤ 1024², ≤ 100k triangles, ≤ 3 draw-call-heavy materials. `size-limit` entry `three-hero` enforces the JS figure; an integration test asserts the asset manifest total. |
| Runtime | `dpr={[1, 1.5]}`, `frameloop="demand"` with invalidation on scroll/pointer, pause when the hero leaves the viewport (IntersectionObserver) or the tab is hidden; `powerPreference: 'high-performance'` off (thermal); no post-processing passes in release 1; input handlers throttled to animation frames so INP stays < 200 ms. |
| Failure | `onError`/context-loss → unmount canvas, keep poster, log to Sentry once per session, set `sessionStorage.three_off = 1` so the page does not retry. |
| Kill switch | Admins can turn the flag off in settings (arch §7.9) without a deploy; `revalidateTag('content')`. |

### B7. Scroll animation stack (GSAP + ScrollTrigger + Lenis, Motion)

| Rule | Detail |
|------|--------|
| Loading | `components/motion/ChapterScroller.tsx` is a client component imported with `next/dynamic` on `/` only; GSAP core + ScrollTrigger + Lenis are in that chunk (≤ 60 KB) and load after hydration. Other routes never ship GSAP. |
| What animates | Transforms and opacity only (compositor properties); no animated `width/height/top/left`, no layout reads inside `onUpdate`. `will-change` applied only while a chapter is active. |
| Scroll-jacking | `scrub: true` with GSAP pin-with-spacing allowed on chapters at **≥ 1024 px**; **no pinning below 1024 px** (chapters become plain stacked sections with a single fade/translate on enter; no scroll-snap anywhere — MASTER_SPEC §7 "Scroll behaviour"). Native scrolling and keyboard/space/page-down always work; Lenis `syncTouch: false`, disabled on touch devices and when reduced motion is set (R-801). |
| Reduced motion | `gsap.matchMedia()` with `(prefers-reduced-motion: no-preference)`; under `reduce` all timelines are skipped, content is fully visible statically, Lenis is not started, Motion components use `useReducedMotion()` (arch §4). Admin theme/motion toggle in the site header also exposes a "Reduce motion" switch stored per device (D-905 pattern). |
| Motion (framer) | `LazyMotion` with `domAnimation` features (`m.` components) to keep the shared chunk ≈ 15 KB; `domMax` only on screens that use drag (admin dashboard grid). |
| CLS | Chapter containers have fixed `min-height` (`100svh`) and reserved media boxes; text never reflows on animation start. |
| INP | ScrollTrigger callbacks do no React state updates per frame; React state changes at most once per chapter boundary. |

### B8. Caching and ISR per route (arch §6)

| Route family | Strategy | Invalidation |
|--------------|----------|--------------|
| `/`, `/services`, `/legal/*` | ISR (see §A2) + `unstable_cache` per query with tags `content` | admin publish action → `revalidateTag('content')` |
| `/products`, `/products/[slug]`, `/blog*`, `/projects*` | ISR with per-entity tags `product:<slug>`, `blog:<slug>`, `case-study:<slug>` plus `catalog`/`blog`/`content` | publish/unpublish/schedule cron/price change → module `service.ts` calls `revalidateTag` for entity + list tags + `sitemap` |
| Prices / display currency | HTML has base-currency prices; `<PriceSwap>` client island reads the `ck_currency` cookie (visitor selector, or `users.display_currency` loaded on login — MASTER_SPEC §7 "Visitor currency selector"), fetches `/api/fx` (`Cache-Control: public, max-age=3600`) once and rewrites amounts in fixed-width price slots when the currency ≠ base; the ISR page therefore stays shared across currencies. | FX cron refresh |
| Theme | `data-theme` is set on `<html>` by a ≤ 300-byte inline head script (CSP nonce) reading the `ck_theme` cookie before first paint (no flash, no CLS); the Server Action that saves `users.theme_pref` refreshes the cookie (MASTER_SPEC §7 "Theme attribute on ISR pages"); both themes' token CSS ships in release 1, the toggle appears only with `theme_light_editorial` on; the ISR HTML itself is theme-agnostic. | — |
| Auth-aware header (avatar/login) | Streams inside a `<Suspense>` boundary using cookies; the rest of the page is static. | — |
| `/account/*`, admin | `dynamic = 'force-dynamic'`, `Cache-Control: private, no-store`. | — |
| Static assets | `/_next/static/*` immutable 1 year (framework default); R2 media immutable with hashed keys; PDFs private, presigned 5 min (arch §6). | — |
| OG images, sitemap, robots | 24 h / 1 h / 24 h with `stale-while-revalidate`. | `revalidateTag('sitemap')` |
| CDN | Vercel edge cache now; on a VPS Caddy in front of Next with ISR cache on disk; optional Cloudflare proxy for static assets only (docs/12 §9). | |

### B9. Third-party script policy

| Script | Allowed | Loading | Budget |
|--------|---------|---------|--------|
| Umami | yes (only analytics, D-1301) | `<Script src={NEXT_PUBLIC_UMAMI_SRC} data-website-id={NEXT_PUBLIC_UMAMI_WEBSITE_ID} strategy="lazyOnload" data-do-not-track>` on public + account routes; not on admin | ≈ 2 KB |
| Cloudflare Turnstile | yes, on pages with a public form (D-1204) | `strategy="lazyOnload"` injected by the form component only when the form scrolls into view or receives focus; explicit render, invisible mode | ≈ 30 KB, after interaction |
| Sentry browser SDK | yes | `@sentry/nextjs` with `tracesSampleRate: 0.1`, no Replay in release 1, lazy-loaded integrations | ≤ 35 KB |
| YouTube/Vimeo | only via facade (§B5) | on click | 0 before click |
| Google OAuth | redirect flow only; no GIS script | — | 0 |
| Anything else (fonts CDN, GTM, chat widgets, A/B tools, GA4) | **no** | — | — |

CSP (docs/09) enumerates exactly these origins; adding a script requires a docs/09 change.

### B10. Measurement — lab (CI) and field

**Lighthouse CI** (`@lhci/cli`, job `lhci` in docs/12 §4) runs on every PR against the Vercel preview URL (or `next start` in the runner when no preview) for `/`, `/products`, `/products/<seeded-slug>`, `/projects/<seeded-slug>`, `/blog/<seeded-slug>`, `/services`, `/contact`, `/legal/privacy`; mobile preset, 3 runs, median. `lighthouserc.json` assertions:

| Audit | Level | Threshold |
|-------|-------|-----------|
| `categories:performance` | error (`/` warn) | ≥ 0.90 (`/` ≥ 0.85) |
| `largest-contentful-paint` | error | ≤ 2500 ms |
| `cumulative-layout-shift` | error | ≤ 0.1 |
| `total-blocking-time` | error | ≤ 300 ms |
| `interactive` | warn | ≤ 5000 ms |
| `total-byte-weight` | error | per §B2 total |
| `unused-javascript`, `render-blocking-resources`, `uses-responsive-images`, `modern-image-formats` | warn | default |
| `categories:accessibility`, `categories:seo`, `categories:best-practices` | error | ≥ 0.95 / ≥ 0.95 / ≥ 0.90 |
| `is-crawlable` (public), `canonical`, `structured-data` (manual, validated by a unit test against `schema-dts`) | error | pass |

Results are posted as a PR comment with deltas versus `main`; a weekly scheduled run against production stores JSON in the CI artifacts for trend review.

**Field** (`components/site/WebVitals.tsx`, client, all routes): `web-vitals` `onLCP/onINP/onCLS/onTTFB/onFCP` → `navigator.sendBeacon('/api/analytics/vitals')` → row in `analytics_events` (`name='web_vital'`, `props: {metric, value, rating, route (pattern, not path), navType, device: 'mobile'|'desktop', connection, theme, three: bool}`), sampled 100 % (traffic is small). No user identifier is attached to vitals rows. The admin "System / AI health" widget group (arch §7.6) shows p75 per metric per route for the last 28 days with the D-1303 thresholds coloured.

**Bundle size**: `@next/bundle-analyzer` report attached to CI; `size-limit` config lists each route chunk, `three-hero`, `chapter-scroller`, `pdf-viewer` with the §B2 budgets.

### B11. Accessibility performance and reduced motion (D-907)

- `prefers-reduced-motion: reduce` → no GSAP timelines, no Lenis, no 3D, motion-based `transition`/`animation` tokens collapse to 0 via `@media` rule in `tokens.css`; opacity crossfades ≤ 200 ms for state changes remain (MASTER_SPEC §7 "Reduced motion", D-907); content fully readable without scrolling tricks.
- `prefers-reduced-data: reduce` → no 3D, posters at the smaller size, video facade shows a static thumbnail without prefetch.
- Focus management: pinned chapters never trap focus; skip link `#main` first in DOM; `aria-hidden` on the decorative canvas; live regions only for checkout status.
- Colour contrast and target sizes per docs/08; `axe` (Playwright + `@axe-core/playwright`) runs in CI on every route of the screen inventory in both themes once Theme 2 ships.

### B12. Mobile-specific rules

| Rule |
|------|
| No 3D, no pinning, no smooth-scroll library on touch devices (§B6, §B7). |
| Hero poster ≤ 90 KB at 750 w; `sizes="100vw"`. |
| Initial JS on `/` for mobile identical to desktop minus 3D chunk (which is never requested). |
| Tap targets ≥ 44×44 px; `touch-action: manipulation` on buttons to remove the 300 ms delay on older iOS. |
| `viewport-fit=cover`, `100svh` units (not `100vh`) to avoid CLS from the iOS URL bar. |
| Fonts: body font not preloaded; `font-display: swap`. |
| Turnstile loads only on focus of a form field. |
| Images: `deviceSizes` include 640/768 so mobile never downloads desktop widths. |
| Chatbot (account area) streams over SSE; message list virtualised above 200 messages. |

### B13. Regression monitoring

| Signal | Where | Threshold → action |
|--------|-------|--------------------|
| LHCI on PR | GitHub check | any error-level assertion fails the PR (required check for changes under `app/(site)`, `components/site|motion|three`, `styles/`). |
| `size-limit` | GitHub check | > budget or > +10 % vs `main` fails. |
| Field p75 (28-day) | admin System widget, computed by daily cron `vitals.rollup` | LCP > 2.5 s, INP > 200 ms or CLS > 0.1 for 7 consecutive days on any public route → in-app notification to super admins (D-707) with the route and the worst device class. |
| Weekly production LHCI | GitHub scheduled workflow | performance score drop > 5 points vs previous week → notification. |
| Sentry | performance transactions at 10 % | p95 server response of ISR-miss pages > 2 s → alert (docs/12 §7). |
| Third-party audit | quarterly manual | any script outside §B9 → remove. |

---

## Open inconsistencies

1. Resolved: `slug_redirects` exists in DB §2 (MASTER_SPEC §7 "Slug changes"); §A3 now allows renames with a 301 (FR-SEO-07).
2. Resolved: `product_media.alt` and `media.blur_hash` exist in DB §2 (FR-CONT-08); §A7 and §B4 updated.
3. Resolved: D-121 "cards" wins — the product page shows a blog card linking to `/blog/[slug]` (MASTER_SPEC §7 "Blog on product page"); §A7 unchanged.
4. Resolved: MASTER_SPEC §4.11 lists the `three_hero` kill switch (plus `bundles`, `vendor_marketplace`); §B6 relies on it.
5. Resolved: `/legal/*` now uses 3600 s, inside the arch §6 ISR window (tag-invalidated on publish anyway).
6. Resolved (no contradiction): WebSite, FAQPage, Service, VideoObject, ItemList, ContactPage extend the baseline §14 minimum set.
7. Deferred to `docs/07` (owned elsewhere): the momentary base → display-currency swap after hydration (§B8, fixed-width price slots) is a UX detail for the screen spec; MASTER_SPEC §7 "Visitor currency selector" fixes the cookie mechanism used here.
8. Resolved (informational): admin-host vitals are tagged `host='admin'` and excluded from public p75; polling cost is within the Neon free-plan budget (docs/12 §12).
