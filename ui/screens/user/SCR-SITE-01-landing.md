# SCR-SITE-01 — Landing (story chapters)

**Route:** `/` · **Render:** ISR (300 s; tags `content`, `catalog`, `blog`) · **App:** Site

## Purpose
The cinematic front door. Five full-viewport scroll chapters tell the CodeKraft story (Who we are → What we build → What we sell → Proof → Talk to us), convert visitors into project leads ("Start a project") and product buyers ("Explore products"), and surface featured products and product-blog teasers. It must pass Core Web Vitals "good" on a mid-range phone (D-1303).

## User/role
Visitor, Customer (same content; Customer sees avatar menu in header).

## Entry points
Direct/organic, wordmark link from every page, "Back to site" from account, 404 "Go home", OG/social shares.

## Layout
- **Desktop (≥ lg):** Header overlays the hero (transparent → glass after 80 px).
- A vertical "story rail" fixed at the right edge shows five dots with chapter names on hover/focus; current chapter highlighted.
- Chapters are pinned sections (GSAP pin-with-spacing at ≥ lg only, media column pinned, never scroll-jacked — no `scroll-snap`, no wheel capture, MASTER_SPEC §7 "Scroll behaviour"), each 100dvh:
1. **Hero / Who we are** — WebGL 3D scene (or static poster) fills the background; left column: eyebrow ("CodeKraft"), h1 (from `landing_chapters.who.title`), subtitle, two CTAs side by side; small scroll hint at bottom.
2. **What we build** — split: left sticky headline + body; right a stack of 8 service cards (from `services`) that slide in as the user scrolls; footer link "See all services".
3. **What we sell** — headline + horizontal row of up to 6 featured product cards (`featured_products`), each: cover image, name, category chip, from-price in display currency, "Coming soon" badge when flagged; link "Explore all products".
4. **Proof** — three-part: client logo strip (`client_logos`), 3 case-study cards (latest published), 2–3 site testimonials with count-up stats if configured in chapter `media`/`cta` JSON.
5. **Talk to us** — headline, short inquiry form (name, email, what do you need? select, message) inline, primary "Send inquiry"; secondary "Explore products". Below it, if any product blogs exist, "From the blog" teaser row (3 cards) and the site footer.

- **Phone:** no pinning, no 3D; chapters stack as normal sections with 24 px vertical rhythm; story rail becomes a thin progress bar under the header; hero CTAs stack full-width; product/service cards become horizontal snap-scroll carousels; the inquiry form is full width.

## Components
- shadcn/ui: `Button` (primary/secondary), `Badge`, `Card`, `Carousel` (phone rows), `Form` + `Input`/`Select`/`Textarea`, `Tooltip` (rail), `Skeleton` (never shown—page is static), `Toast` (inquiry result)
- custom: `components/three/HeroScene` + `HeroPoster`, `components/motion/Chapter`, `components/site/ProductCard`, `CaseStudyCard`, `BlogTeaserCard`, `LogoStrip`, `StoryRail`, `InquirySheet` (shared with services, product CTA and contact).

## Content & copy notes
- All copy from `landing_chapters` (D-1106); defaults seeded.
- No founder names/photos (D-103).
- CTAs: primary "Start a project", secondary "Explore products" (D-802).
- Prices on product cards say "From ₹X" using the lowest active offering price; custom-quote-only products show "Custom quote".
- No partner/ownership info (D-116).
- The inquiry form footnote: "We reply by email within 2 working days." No email/phone/social anywhere (D-808).

## Interactions
- "Start a project" opens the `InquirySheet` (right sheet on ≥ md, bottom drawer on phone) that posts to the same `createLead` action as `/contact` (API-LEAD-01, `source='inquiry_form'`; MASTER_SPEC §7 "Start a project CTA"); the chapter-5 inline form remains for readers who scroll there, and `/contact` keeps the full-page form for SEO and deep links.
- "Explore products" → `/products`.
- Rail dots: click/Enter scrolls to chapter; arrow keys move between dots.
- Product card click → `/products/[slug]`; wishlist heart on card → adds when signed in, otherwise redirects to login with `returnTo`.
- Inquiry submit → Turnstile → Server Action `createLead` (API-LEAD-01) → success panel replaces form ("Thanks, we'll be in touch") with link "Browse products meanwhile"; analytics event `inquiry_submitted`.
- Hero scene reacts subtly to pointer position (parallax ≤ 8 px); no click targets inside the canvas.

## States
- **Default:** as above.
- **Loading:** static HTML paints immediately; 3D scene loads after LCP, poster remains until scene ready then cross-fades 400 ms.
- **Empty:** no featured products → chapter 3 shows 3 most recent published; none at all → chapter 3 shows "Products coming soon" with "Start a project" CTA. No case studies → Proof shows logos + testimonials only. No blogs → teaser row omitted.
- **Error:** scene load failure → poster stays, error logged to Sentry silently. Inquiry submit failure → inline `Alert` "Couldn't send — try again", form values preserved.
- **Success:** inquiry success panel.
- **Permission-denied:** n/a.

## Responsive behaviour
xs–md: stacked sections, carousels, static poster, fade-up reveals. lg–xl: pinned chapters, rail, 3D eligible. 2xl: type scale +1, cards 4-up. tv: type +2, 96 px gutters, chapters keep 100dvh, rail dots enlarged to 24 px, poster instead of 3D unless `pointer:fine` reported.

## Accessibility
- h1 in hero only; chapters are `<section aria-labelledby>`; rail is `<nav aria-label="Story chapters">` with `aria-current`.
- Canvas has `aria-hidden` and the poster's alt describes the scene.
- Scroll-pinning never blocks keyboard navigation (Tab moves through chapters normally).
- Count-up numbers render final values in the DOM for screen readers.
- Form labels visible; success announced via live region.
- Contrast on hero text guaranteed by a gradient scrim over the scene.

## Motion
- GSAP ScrollTrigger pins each chapter; headline letters/paragraphs translate + fade (`transform`/`opacity` only); service cards stagger 60 ms; product row parallax; logos fade; stats count up (600 ms).
- Lenis smooth scroll at ≥ lg. **Reduced motion:** no pinning, no Lenis, no parallax, static poster, no stagger; sections are plain stacked blocks with instant visibility; rail remains as links. **Mobile:** IntersectionObserver fade-up once, `translateY(16px)`, 250 ms.

## Navigation
→ `/products`, `/products/[slug]`, `/services`, `/projects`, `/projects/[slug]`, `/blog/[slug]`, `/contact` (same lead action, full-page form), `/auth/login` (wishlist when signed out). Footer → legal pages.

## Data dependencies
Tables: `T-landing_chapters`, `T-featured_products` + `T-products` + `T-offering_prices` + `T-product_media`/`T-media`, `T-services`, `T-client_logos`, `T-case_studies`, `T-testimonials` (context `site`), `T-product_blogs`, `T-fx_rates`, `T-site_settings` (default theme, base currency, `three_hero` flag), `T-leads` (write), `T-analytics_events` (write).
Queries: `getLandingContent` (API-CONT-09), `listFeaturedProducts` (API-CAT-34), `listServices` (API-CONT-09), `listClientLogos`, `listCaseStudies`, `listTestimonials(site)` (API-CONT-09), `listBlogTeasers` (API-CAT-34). Actions: `createLead` (API-LEAD-01), `toggleWishlist` (API-CAT-35).

## Requirement IDs
D-801, D-802, D-803, D-804, D-904, D-905, D-907, D-1106, D-1303, D-1605, D-116, D-808, D-103, D-1302, A-1301, BR-01, BR-02, A-1402.
