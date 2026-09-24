# PHASE-07 — Public site & customer app UI + SEO

**Wave:** W4 (parallel with P8; 3 agents: A = landing + motion + 3D, B = catalog/content pages + SEO, C = auth + checkout + account) · **Roadmap items:** R1-08, R1-09, R1-17 (UI half), R1-22 (vitals mount), R1-26 (legal page rendering) · **Master plan §6 gate:** e2e: all customer journeys in `docs/10`; Lighthouse CI on `/`, `/products`, `/products/[slug]`, `/projects/[slug]`, `/blog/[slug]`; axe clean.

## Phase objective

Build every `ui/screens/user/*` screen against the tested P3–P6 actions and queries: the cinematic story landing (GSAP/Lenis chapters, 3D hero shipped poster-first behind gates), services, products list/detail with offering selector, PDF viewer, blog card and customisation CTA, case studies, blog, contact/inquiry sheet, legal and system pages; SEO (metadata, sitemap, robots, JSON-LD, OG route, slug 301s); auth screens; checkout, order status and custom-quote pages; all account screens (SCR-ACC-01..12); theme and currency mechanics including the inline head script; Lighthouse and size budgets enforced. UI builders follow the screen specs literally, use only components from `/dev/ui`, and implement every documented state (loading, empty, error, reduced motion, both themes).

## Prerequisites

- P1 (tokens, shadcn set, layouts, middleware, theme resolution), P3 (catalog/content/blog/media/settings/fx/search queries), and — for the checkout/account part — P4 (orders/payments/quotes/invoices), P5 (entitlements/subscriptions), P6 (queries/chat/notifications/analytics/leads). Site pages (P7.1–P7.7) may start as soon as P3 is done (master plan §2).
- Specs: `ui/screens/user/*.md` (all 28 files), `ui/sitemap.md`, `docs/07` §3–§7, `docs/08` §6–§10, `docs/11` Part A + B, `docs/10` §8–§9.
- Assets from founders (E-05, E-07): hero posters `public/hero/hero-poster-{dark,light}.{avif,webp}`, logo set, glTF scene (or the placeholder scene from P7.3), fonts.
- Env: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MEDIA_BASE_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_UMAMI_*`, `LHCI_GITHUB_APP_TOKEN` (optional).
- URLs are settled (MASTER_SPEC §7 "Auth and checkout URLs", `ui/sitemap.md` §2–§3, docs/07 §8.2–§8.3): `/auth/login|register|verify|reset|otp`, `/checkout/[offeringId]`, `/quote/[token]`, `/account/*`. Files live in the route groups of docs/04 §5 (`(auth)/auth/**`, `(account)/account/**`, `(account)/checkout/[offeringId]/**`, `(account)/quote/[token]/**`); no redirects from other paths exist; `lib/routes.ts` is the single source.

## Tasks

| Task | Title | Owner profile | Depends on |
|------|-------|---------------|------------|
| P7.1 | Site shell: header/footer/nav, theme toggle + inline head script, currency selector, system pages | UI builder (B) | — |
| P7.2 | Landing story chapters (2D) with GSAP/ScrollTrigger/Lenis, featured products, blog teasers, inquiry sheet | UI builder (A) | P7.1 |
| P7.3 | 3D hero: poster first, gates, lazy scene, kill switch | UI builder (A) | P7.2 |
| P7.4 | Services, case studies list/detail | UI builder (B) | P7.1 |
| P7.5 | Products list (filters/search/sort) and product detail (offering selector, media, PDF viewer, FAQs, changelog, blog card, customisation CTA) | UI builder (B) | P7.1 |
| P7.6 | Blog index/post, contact/inquiry form, legal pages | UI builder (B) | P7.1 |
| P7.7 | SEO: metadata, JSON-LD, sitemap, robots, OG route, slug redirects, ISR tags | domain-standard (B) | P7.4, P7.5, P7.6 |
| P7.8 | Auth screens (login, register, verify, reset, OTP flagged) | UI builder (C) | P7.1 |
| P7.9 | Checkout, order status, custom-quote page | UI builder (C) | P7.8 |
| P7.10 | Account shell, overview, purchases, entitlement detail | UI builder (C) | P7.8 |
| P7.11 | Account: invoices & payments, queries, chatbot, wishlist, notifications, profile & settings | UI builder (C) | P7.10 |
| P7.12 | Performance budgets (LHCI, size-limit, vitals mount), customer e2e + axe suites, phase gate | domain-standard + reviewer | all |

### P7.1 Site shell, theme toggle, currency selector, system pages
- Owner profile: UI builder (agent B)
- Requirement IDs: FR-DASH-04 (device half), FR-A11Y-01, FR-A11Y-02, NFR-THEME-01, NFR-RESP-01, D-905, D-111, D-012, API-AUTH-04, API-AUTH-09, SCR-SITE-11, docs/07 §3.1, §3.2, §4.2, §4.3, §4.6, docs/08 §6.4, §10, MASTER_SPEC §7 "Theme toggle at launch", "Visitor currency selector", "Theme attribute on ISR pages", S-16, S-17
- Description: `components/site/Header.tsx` (logo, nav per docs/07 §3.1, sign-in/account, mobile drawer with focus trap), `Footer.tsx` (legal links, no contact details — D-808), `ThemeToggle.tsx` (segmented radiogroup, hidden when `themeLightEditorial` flag off; Server Action `updateSettings` sets `ck_theme` cookie and `users.theme_pref`; 400 ms crossfade skipped under reduced motion; hydrates from the attribute), `CurrencySelector.tsx` (cookie `ck_currency`; logged-in saves `display_currency`), "Reduce motion" switch stored per device, `<meta name="theme-color">` update, skip link, `WebVitals` and `UmamiScript` mounts. Finalise the ≤ 300-byte inline head script from P1.7 (nonce + poster preload injection per docs/08 §10). System pages: `not-found.tsx`, `error.tsx`, offline fallback, admin-host 403 variant; `noindex`. `lib/routes.ts` route constants.
- Owned paths: `src/components/site/{Header,Footer,ThemeToggle,CurrencySelector,MotionToggle,SkipLink,Nav*}.tsx`, `src/app/(site)/layout.tsx` (replace placeholder), `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/(site)/offline/page.tsx`, `src/lib/routes.ts`. Forbidden: `src/components/ui/**`, `middleware.ts`.
- Dependencies: P1.7, P3.3, P3.12.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/components/site/{theme-toggle,currency-selector,header}.test.tsx` (hidden with flag off; keyboard nav; aria); e2e `tests/e2e/site/theme.spec.ts` (S-16 with flag on/off), `currency.spec.ts` (S-17), `system-pages.spec.ts` (404/403/error, axe), `header-a11y.spec.ts` (Tab order, Escape closes drawer).
- Acceptance criteria:
  - [ ] S-16: toggle persists via cookie, account pref wins after login, hidden with flag off
  - [ ] S-17: visitor sees INR; buyer with USD sees converted "approx." prices
  - [ ] no theme flash on `/` (Playwright asserts attribute before first paint via `document.documentElement.dataset.theme` in `addInitScript` check)
  - [ ] axe clean in both themes; header keyboard operable
- Definition of Done: code + unit + e2e + PROGRESS row + CI green.
- Potential risks and mitigations: inline script CSP under nonce on ISR pages → hash allow-list fallback agreed in P1.7/P9.1; hydration mismatch → `suppressHydrationWarning` on `<html>` only.

### P7.2 Landing story chapters (2D) + motion stack + inquiry sheet
- Owner profile: UI builder (agent A)
- Requirement IDs: FR-SEO-01, FR-A11Y-02, FR-CAT-14 (teasers), FR-LEAD-01 (`inquiry_form` from sheet), NFR-PERF-01, NFR-PERF-02, D-801, D-802, D-904, D-907, R-801, SCR-SITE-01, API-CONT-09 (`getLandingContent`), API-CAT-34, API-LEAD-01, docs/07 §7, docs/08 §6.5, §6.6, §7.2, §7.4, §7.5, docs/11 §B7, MASTER_SPEC §7 "Scroll behaviour", "Start a project CTA", "Reduced motion"
- Description: `/` page (ISR 300 s, tags `content`, `catalog`) rendering the five chapters from `landing_chapters` (`who`, `build`, `sell`, `proof`, `talk`) with `components/site/StoryChapter.tsx`, `ProgressRail.tsx`, featured products (`listFeaturedProducts`) and blog teasers (`listBlogTeasers`) in the "sell" chapter, client logos/testimonials in "proof", dual CTA ("Start a project" → `InquirySheet.tsx` posting to `createLead` with Turnstile; "Explore products" → `/products`). `components/motion/ChapterScroller.tsx` (client, `next/dynamic` on `/` only; GSAP core + ScrollTrigger + Lenis in one chunk ≤ 60 KB gzip; transforms/opacity only; pin-with-spacing at ≥ 1024 px, plain stacked sections below; Lenis disabled on touch and reduced motion; `gsap.matchMedia` reduced-motion branch skips timelines; exposes `window.__ck_scrolltrigger_registered` in test builds), `PageTransition`, `Reveal`, `CountUp`, `useChapter` from `motion.ts` tokens; `LazyMotion` `domAnimation`. Chapter containers `min-height: 100svh` with reserved media boxes (CLS).
- Owned paths: `src/app/(site)/page.tsx`, `src/components/site/{StoryChapter,ProgressRail,InquirySheet,FeaturedProducts,BlogTeasers,ProofWall}.tsx`, `src/components/motion/**`. Forbidden: `src/components/three/**` (P7.3), `src/app/(site)/contact/**` (P7.6 — the sheet and the page share `InquiryForm.tsx` owned here).
- Dependencies: P7.1; P3.11, P3.6, P3.10, P6.3.
- Expected files/modules: as listed + `src/components/site/InquiryForm.tsx` (shared with P7.6).
- Tests required: unit `tests/unit/components/motion/*.test.tsx` (reduced motion → no GSAP registration; below `lg` → no pin); e2e `tests/e2e/site/landing.spec.ts` (chapters render server-side — HTML contains all five chapter headings before hydration; CTAs; inquiry sheet submits with Turnstile test token → lead; keyboard scroll works; `reducedMotion: 'reduce'` → `ScrollTrigger` not registered, no `transform` transitions > 0 ms — docs/10 §8), axe both themes, Playwright trace asserting no long task > 50 ms per chapter scroll frame.
- Acceptance criteria:
  - [ ] all chapter content present in server HTML (FR-SEO-01)
  - [ ] no pinning ≤ 1024 px; native scroll and keyboard always work
  - [ ] reduced-motion pass per docs/10 §8
  - [ ] `chapter-scroller` chunk ≤ 60 KB gzip; GSAP absent from other routes (`size-limit`)
- Definition of Done: code + tests + LHCI on `/` within budget (P7.12 confirms) + PROGRESS row + CI green.
- Potential risks and mitigations: GSAP/Lenis blowing TBT → `scrub` transforms only, no React state per frame; if `/` performance < 0.85 the orchestrator may cut pinning (documented fallback, master plan §7).

### P7.3 3D hero
- Owner profile: UI builder (agent A)
- Requirement IDs: FR-PERF-01, NFR-PERF-03, FR-OPS-03 (`three_hero`), D-904, D-907, D-1605, R-801, SCR-SITE-01 (hero), docs/08 §8, docs/11 §B6, master plan §7 "Cinematic landing blows CWV"
- Description: `components/three/HeroPoster.tsx` (server-rendered `next/image` AVIF/WebP poster ≤ 150 KB desktop / ≤ 90 KB mobile with `priority`; the LCP element), `components/three/gates.ts` (all gates of docs/11 §B6: flag on, no reduced motion, ≥ 1024 px and `(hover: hover) and (pointer: fine)`, no `saveData`/2g/3g, `deviceMemory ≥ 4`, `hardwareConcurrency ≥ 4`, WebGL2 creatable, document visible, `sessionStorage.three_off` unset), `HeroScene.tsx` (`dynamic(..., { ssr: false })`, loaded after `onLCP` or `load + 1500 ms` then `requestIdleCallback`; r3f + drei named imports; `dpr [1, 1.5]`, `frameloop="demand"`, pause off-screen/hidden tab; no post-processing; context-loss → unmount, keep poster, Sentry once, `three_off = 1`), `HeroMount.tsx` client wrapper layering canvas above poster with fade-in after first frame. Scene assets under `public/hero/` (glTF Draco/meshopt ≤ 1.5 MB, KTX2 ≤ 1024², ≤ 100k triangles; placeholder scene until founders deliver). `size-limit` entry `three-hero` ≤ 400 KB target / 600 KB ceiling; asset-manifest integration test. Kill switch via settings flag revalidates `content`.
- Owned paths: `src/components/three/**`, `public/hero/**`, `.size-limit.json` entry `three-hero` (append). Forbidden: `src/components/motion/**`.
- Dependencies: P7.2.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/components/three/gates.test.ts` (matrix of gate inputs); e2e `tests/e2e/site/hero.spec.ts` (desktop chromium: canvas appears after LCP and only after gates; mobile Chrome: canvas absent, poster is LCP element; reduced motion: absent; flag off: absent and no `three` chunk requested — network assertion), `tests/integration/three-assets.test.ts` (manifest total ≤ 1.5 MB).
- Acceptance criteria:
  - [ ] mobile and reduced-motion never download the 3D chunk (network log)
  - [ ] desktop: poster paints first, canvas fades in after first frame
  - [ ] `three-hero` chunk ≤ 600 KB gzip (`size-limit` fails otherwise)
  - [ ] flag off hides the hero without deploy
- Definition of Done: code + tests + LHCI desktop informational run recorded + PROGRESS row + CI green.
- Potential risks and mitigations: WebGL flakiness in headless CI → e2e asserts gating/network, not rendering fidelity; asset delivery late → placeholder scene ships, founder asset swapped in P9.8.

### P7.4 Services, case studies list/detail
- Owner profile: UI builder (agent B)
- Requirement IDs: FR-CAT-15, FR-SEO-01, FR-SEO-02, BR-01, D-803, D-806, SCR-SITE-02, SCR-SITE-05, SCR-SITE-06, API-CONT-09 (`listServices`, `listCaseStudies`, `getCaseStudyBySlug`), docs/07 §4.5 (empty states), docs/08 §6.3
- Description: `/services` (ISR, tag `content`): one section per published service with deliverables and an inquiry CTA opening `InquirySheet` with `serviceInterest` prefilled; no prices. `/projects` grid of published case studies (`CaseStudyCard.tsx`) with empty state; `/projects/[slug]` problem/solution/results (rendered HTML), tech stack chips, gallery (`next/image` with dimensions, lightbox dialog), related products, breadcrumbs. `generateStaticParams` for published slugs; slug redirect handling via P7.7 helper. Both themes, all states.
- Owned paths: `src/app/(site)/services/**`, `src/app/(site)/projects/**`, `src/components/site/{ServiceSection,CaseStudyCard,Gallery,TechStackChips,Breadcrumbs}.tsx`. Forbidden: other pages.
- Dependencies: P7.1; P3.11.
- Expected files/modules: as listed.
- Tests required: e2e `tests/e2e/site/services.spec.ts`, `case-studies.spec.ts` (server HTML contains content; unpublished → 404; gallery keyboard; axe both themes).
- Acceptance criteria:
  - [ ] no price appears on `/services` (assertion on rendered text against a currency regex)
  - [ ] unpublished case study 404; published renders with breadcrumbs
  - [ ] axe clean both themes
- Definition of Done: code + e2e + PROGRESS row + CI green.
- Potential risks and mitigations: large galleries hurting LCP → lazy below the fold, explicit sizes.

### P7.5 Products list and product detail
- Owner profile: UI builder (agent B)
- Requirement IDs: FR-CAT-05, FR-CAT-06, FR-CAT-07, FR-CAT-08, FR-CAT-10, FR-CAT-11, FR-CAT-13, FR-CAT-14 (blog card), FR-COM-14 (`product_view`), FR-AUTH-02 (Buy gate), FR-SEO-01, D-121, D-309, D-310, D-311, D-312, D-313, D-314, D-315, D-805, A-301, A-303, SCR-SITE-03, SCR-SITE-04, API-CAT-30, API-CAT-31, API-CAT-32, API-CAT-35, API-LEAD-01 (`product_cta`), API-OPS-01, docs/07 §4.15, docs/08 §6.12, §6.18, MASTER_SPEC §7 "Blog on product page", "Unlisted product demo links"
- Description: `/products` (SSR from query params): search box (`q`), facet filters (category tree flat, price range in display currency, purchase model, delivery type, tech stack, industry, audience), sort control, `ProductCard.tsx` grid with `fromPrice`/compare-at/coming-soon badge, pagination with `noindex` beyond page 1 and canonical to the unfiltered URL, empty state. `/products/[slug]` (ISR 300 s, tag `product:<slug>`): media gallery (images/screenshots/video embed or file/`PdfViewer.tsx` with `title` on iframe and skip link), `OfferingSelector.tsx` (per docs/08 §6.12; prices in display currency + base; enabled methods; "Buy now" → `/checkout/[offeringId]` or login `returnTo`; hidden for coming-soon with "Notify me" → wishlist; `custom_quote` model → "Request quote" creates a `product_cta` lead), description/features/benefits/audience/use cases/industry/tech/requirements, FAQs accordion, curated testimonials, current version + public changelog, live-demo link, blog card with excerpt linking to `/blog/[slug]`, "Need customisation?" CTA (inquiry sheet with `productId`), wishlist toggle (login gate), `product_view` event via `trackEvent`, breadcrumbs. Unlisted: `noindex` meta; unpublished: 404 unless entitlement holder.
- Owned paths: `src/app/(site)/products/**`, `src/components/site/{ProductCard,ProductFilters,SearchBox,OfferingSelector,PdfViewer,MediaGallery,FaqAccordion,Changelog,BlogCard,WishlistButton,CustomisationCta}.tsx`. Forbidden: checkout pages (P7.9).
- Dependencies: P7.1; P3.6, P3.7, P3.10, P3.12, P6.3, P6.8.
- Expected files/modules: as listed + `.size-limit.json` entry `pdf-viewer`.
- Tests required: unit `tests/unit/components/site/{offering-selector,product-filters}.test.tsx`; e2e `tests/e2e/site/products-list.spec.ts` (filters/sort/search via URL; unlisted absent; canonical/noindex rules), `product-detail.spec.ts` (all sections present server-side; Buy → login redirect for visitor; verified buyer → checkout; coming-soon has no Buy; unlisted reachable with `noindex`; PDF viewer a11y), axe both themes.
- Acceptance criteria:
  - [ ] S-01 step 2 and S-11 step 5 UI behaviours pass
  - [ ] product page never exposes ownership data (DOM text assertion)
  - [ ] `pdf-viewer` chunk lazy and within budget
  - [ ] LHCI ≥ 0.90 on `/products` and `/products/<seeded>` (P7.12)
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: SSR list with many facets slow on Neon cold start → facets cached with tag `catalog`; page shell streams.

### P7.6 Blog, contact, legal pages
- Owner profile: UI builder (agent B)
- Requirement IDs: FR-CAT-14, FR-CONT-04, FR-LEAD-01, FR-LEAD-02, FR-SEC-02, FR-SEO-01, D-804, D-807, D-808, D-1204, SCR-SITE-07, SCR-SITE-08, SCR-SITE-09, SCR-SITE-10, API-CAT-33, API-CONT-09 (`getLegalPage`), API-LEAD-01, S-14 steps 1–3 (UI), docs/07 §4.7
- Description: `/blog` (ISR 60 s, tag `blog`) teaser index; `/blog/[slug]` (tag `blog:<slug>`) post with rendered HTML, product card, author/date, breadcrumbs. `/contact` (SSG shell + client `InquiryForm` from P7.2 with Turnstile invisible widget, honeypot, field errors via `aria-describedby`, success state "thanks", no contact details); rate-limit and captcha error states. `/legal/[key]` (ISR 3600 s, tag `content`) for `privacy|terms|refunds|license` with version/date footer; refunds page shows the manual-payment-only wording (X-10).
- Owned paths: `src/app/(site)/blog/**`, `src/app/(site)/contact/**`, `src/app/(site)/legal/**`, `src/components/site/{BlogPostCard,LegalPage,TurnstileWidget}.tsx`. Forbidden: `InquiryForm.tsx` (P7.2 owns; request changes).
- Dependencies: P7.1, P7.2 (form); P3.10, P3.11, P6.3.
- Expected files/modules: as listed.
- Tests required: e2e `tests/e2e/site/blog.spec.ts`, `contact.spec.ts` (S-14 steps 1–3 through the UI: valid token → thanks + lead; invalid → error; 6th → 429 message), `legal.spec.ts` (four keys render; version footer), axe both themes.
- Acceptance criteria:
  - [ ] S-14 UI steps pass; no lead on invalid token
  - [ ] legal pages present and match seeded copy; refunds wording present
  - [ ] blog post server-rendered with product card
- Definition of Done: code + e2e + PROGRESS row + CI green.
- Potential risks and mitigations: Turnstile widget in CI → Cloudflare test site key always passes; CSP `frame-src challenges.cloudflare.com` needed (P9.1 coordination).

### P7.7 SEO: metadata, JSON-LD, sitemap, robots, OG route, slug redirects, ISR tags
- Owner profile: domain-standard (agent B)
- Requirement IDs: FR-SEO-01, FR-SEO-02, FR-SEO-03, FR-SEO-04, FR-SEO-05, FR-PERF-02, A-801, A-1301, D-314, docs/06 §1.10, §3.6, docs/11 §A2–§A8, `ui/sitemap.md` §1, MASTER_SPEC §7 "Slug changes"
- Description: `src/modules/seo/**` (P7's per master plan §3): `buildMetadata(page)` (title, description, canonical, OG/Twitter from admin SEO fields with fallbacks; `metadataBase` from `NEXT_PUBLIC_SITE_URL`; `noindex` rules for unlisted/filtered/auth/account), JSON-LD builders typed with `schema-dts` (`Organization` + `WebSite` on `/`, `Service` list, `ItemList`, `Product` + `Offer` + `FAQPage`, `CollectionPage`, `Article`/`BlogPosting`, `ContactPage`, `WebPage`, `BreadcrumbList`), `src/app/sitemap.ts` (published non-unlisted products, case studies, blogs, static pages; `lastModified` gated on `launched_at`; cached with tag `sitemap`), `src/app/robots.ts` (site: disallow `/account`, `/auth`, `/api`; admin host: disallow all), `src/app/api/og/[type]/[slug]/route.ts` (`next/og` 1200×630 from published data with theme tokens; admin-uploaded OG → 302; `s-maxage=86400`; 404 unpublished), slug 301 helper used by product/case-study/blog pages (`resolveRedirect` → `permanentRedirect`), ISR `revalidate` values per docs/06 §1.10 verified on every page.
- Owned paths: `src/modules/seo/**`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/api/og/**`, `src/lib/seo-redirect.ts`. Forbidden: page files (provide helpers; page owners call them — B owns those pages anyway).
- Dependencies: P7.4, P7.5, P7.6.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/seo/{metadata,jsonld,sitemap-filter}.test.ts` (Product JSON-LD fields; unlisted excluded; `schema-dts` type check); integration `tests/integration/api/og-route.test.ts`; e2e `tests/e2e/site/seo.spec.ts` (`/sitemap.xml` valid XML and excludes unlisted/draft; `/robots.txt` per host; canonical present; old slug → 301 → new slug; JSON-LD parses on `/`, product, blog, case study).
- Acceptance criteria:
  - [ ] S-11 step 4/5 sitemap assertions pass
  - [ ] every public route has title/description/canonical/OG (LHCI SEO ≥ 0.95)
  - [ ] slug change yields a 301 from the old URL
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: `next/og` fonts → bundle a single font file; sitemap on Neon cold start → cached with tag and 1 h revalidate.

### P7.8 Auth screens
- Owner profile: UI builder (agent C)
- Requirement IDs: FR-AUTH-01, FR-AUTH-02, FR-AUTH-03, FR-AUTH-04, FR-AUTH-11, FR-SEC-02 (signup/reset Turnstile), SCR-AUTH-01..05, API-AUTH-01, `ui/sitemap.md` §2, §5 (redirect rules), S-01, S-18 (UI), docs/09 §7 (Turnstile on signup/reset, login after 3 failures)
- Description: `/auth/login` (email/password, Google button, `returnTo` same-origin only, `?reason=suspended|replaced` banners, Turnstile after 3 failures per IP), `/auth/register` (password policy hints, Turnstile, "check your inbox" state), `/auth/verify` (token consumption, used/expired state, resend with 3/h notice; interstitial variant used when an unverified user reaches checkout), `/auth/reset` (request + set states; identical response copy), `/auth/otp` (404 unless `phone_otp` flag; UI complete behind the flag). Signed-in visitors redirected to `/account`. All forms react-hook-form + Zod from `modules/auth/types`, errors via `aria-describedby`.
- Owned paths: `src/app/(auth)/auth/**` (pages at `/auth/*`), `src/components/account/auth/**`. Forbidden: `src/modules/auth/**`.
- Dependencies: P7.1; P1.5.
- Expected files/modules: pages for the five screens + `AuthCard.tsx`, `GoogleButton.tsx`, `PasswordField.tsx`.
- Tests required: e2e `tests/e2e/auth/register-verify.spec.ts` (S-01 full incl. reused link error and mocked Google), `login.spec.ts` (S-18 UI: "signed in elsewhere" banner; idle → login), `reset.spec.ts`, `otp-flag-off.spec.ts` (404), axe on all auth pages both themes (docs/10 §8).
- Acceptance criteria:
  - [ ] S-01 passes end to end through the UI
  - [ ] S-18 banners and redirects render as specified
  - [ ] `/auth/otp` 404 with flag off; renders with flag on (test env)
- Definition of Done: code + e2e + PROGRESS row + CI green.
- Potential risks and mitigations: Google OAuth in CI → mocked provider endpoint via Better Auth test config (P1.5).

### P7.9 Checkout, order status, custom-quote page
- Owner profile: UI builder (agent C)
- Requirement IDs: FR-COM-01, FR-COM-02, FR-COM-03, FR-COM-07, FR-PAY-02, FR-PAY-03, FR-PAY-04, FR-PAY-05, FR-PAY-08, FR-DEL-09, FR-DASH-02, FR-COM-14, D-410, D-416, D-501, D-520, SCR-ACC-10, SCR-ACC-11, SCR-ACC-12, API-COM-01, API-COM-02, API-COM-03, API-COM-04, API-COM-05, API-COM-10, API-PAY-01, API-PAY-02, API-CHAT-01 (`source='order'`), docs/08 §6.15, `ui/sitemap.md` §3, §5, S-02 steps 1–3, S-07 step 1, S-08, S-09 (UI), MASTER_SPEC §7 "Refund request channel", "Custom quote pay link", "Auth and checkout URLs"
- Description: `/checkout/[offeringId]` (SCR-ACC-10, in the `(account)` route group with the minimal account shell; verified customers only, interstitial otherwise; `?renewal=<subscriptionId>` for renewals): billing form prefilled from profile (name/email/country required; company/address/GST optional), coupon field with `previewCheckout` live totals (base currency + display note), payment method radio limited to `enabledMethods`, "Place order" → `createOrder` → redirect to order status; `DUPLICATE_PURCHASE`, `STATE_INVALID`, `RATE_LIMITED` states. `/account/orders/[id]`: status timeline, `PaymentPanel.tsx` (UPI QR + `upi://` link + copy VPA; bank details + reference narration), reference submission form (`submitPaymentReference`), states per FR-DASH-02 next action (submit / awaiting / retry / download / renew / instructions), retry after `failed`, cancel while pending, instructions HTML, invoice link when paid, "Request refund" → `createQuery(source='order')` (opens existing thread if any), 30 s polling. `/quote/[token]` (SCR-ACC-12): quote view from API-COM-10 `{ quote, canAccept }`, login prompt when logged out (`returnTo=/quote/<token>`), read-only "sign in as the invited customer" when `canAccept=false`, accept → checkout flow for the invited verified customer, expired state, unknown token → 404 (`ui/sitemap.md` §5).
- Owned paths: `src/app/(account)/checkout/[offeringId]/**`, `src/app/(account)/account/orders/**`, `src/app/(account)/quote/[token]/**`, `src/components/account/{BillingForm,CouponField,PaymentMethodPicker,PaymentPanel,ReferenceForm,OrderTimeline,QuoteView}.tsx`. Forbidden: `src/modules/**`, any redirect route for other checkout/quote paths (none exist).
- Dependencies: P7.8; P4.2, P4.3, P4.4, P4.6, P6.5.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/components/account/{payment-panel,coupon-field}.test.tsx` (QR renders the `upi://` string; totals update); e2e `tests/e2e/account/checkout.spec.ts` (S-02 1–3, S-08 steps 1, 2, 4 UI), `order-status.spec.ts` (next-action matrix; refund request opens one thread), `custom-quote.spec.ts` (S-09 steps 2 and 5 UI; step 3 asserts the read-only view per MASTER_SPEC §7 / docs/06 API-COM-10, not the 404 docs/10 still mentions), axe both themes.
- Acceptance criteria:
  - [ ] S-02 steps 1–3 and S-08 pass through the UI
  - [ ] unverified user cannot reach checkout (interstitial)
  - [ ] order page polls every 30 s and reflects admin confirmation without reload
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: QR image as data URL in CSP `img-src data:` (allowed per docs/09 §9).

### P7.10 Account shell, overview, purchases, entitlement detail
- Owner profile: UI builder (agent C)
- Requirement IDs: FR-DASH-01, FR-DASH-02, FR-DASH-06, FR-DASH-07, FR-DASH-09, FR-DASH-10, FR-DEL-04, FR-DEL-05, FR-DEL-06, FR-DEL-07, FR-DEL-09, FR-DEL-15, FR-DEL-16, D-1001, D-1004, SCR-ACC-01, SCR-ACC-02, SCR-ACC-03, API-DASH-01, API-DEL-01, API-DEL-02 (route), API-DEL-03, API-DEL-04, API-DEL-05, API-NOTIF-02, docs/07 §3.3, §4.4, docs/08 §6.13, §6.14, S-02 6–8, S-03 3, S-04 2, S-05, S-06 2/6 (UI)
- Description: `(account)/layout.tsx` shell (sidebar per docs/07 §3.3, notification bell polling 30 s with focus refetch, badge/toast). `/account` overview (active entitlements ≤ 5, pending orders, renewals due, open queries, unread count, wishlist count). `/account/purchases` list with status/delivery type/access period filters. `/account/purchases/[id]` per-type detail from `EntitlementView`: downloads list with remaining count announced (`aria-live`), download via `GET /api/files/download/...` (cap-reached state with one-click query), license key masked + reveal (audited), provisioning notes, service checklist n/m, subscription block (next due, grace deadline, Renew → renewal checkout, Cancel with confirm), instructions HTML, versions/changelog, download history. Suspended/revoked/expired states hide downloads and keys.
- Owned paths: `src/app/(account)/layout.tsx` (replace placeholder), `src/app/(account)/account/page.tsx`, `src/app/(account)/account/purchases/**`, `src/components/account/{AccountSidebar,NotificationBell,EntitlementCard,DownloadList,LicenseKeyReveal,ServiceChecklist,SubscriptionPanel,ProvisioningNotes}.tsx`. Forbidden: `src/modules/**`.
- Dependencies: P7.8; P5.9, P5.3, P5.4, P5.6, P6.1.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/components/account/{license-key-reveal,download-list,subscription-panel}.test.tsx`; e2e `tests/e2e/account/purchases.spec.ts` (S-02 6–8, S-03 step 3, S-04 step 2, S-05 customer view, S-06 steps 2 and 6 UI), `overview.spec.ts`, axe both themes.
- Acceptance criteria:
  - [ ] download cap UI: 4th attempt shows "limit reached, contact support" and creates a query on click
  - [ ] key masked until reveal; hidden when not active
  - [ ] renew/cancel controls follow subscription status
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: `EntitlementView` field gaps → additive change through P5 owner with Zod snapshot update.

### P7.11 Account: invoices & payments, queries, chatbot, wishlist, notifications, profile & settings
- Owner profile: UI builder (agent C)
- Requirement IDs: FR-DASH-01, FR-DASH-03, FR-DASH-04, FR-DASH-05, FR-DASH-08, FR-CAT-13, FR-LEAD-07, FR-LEAD-08, FR-CHAT-01..05, FR-NOTIF-01, D-1001, D-1003, SCR-ACC-04..09, API-COM-12, API-COM-13, API-DASH-02, API-DASH-03, API-CHAT-02, API-CHAT-03, API-CHAT-06, API-CHAT-07, API-CHAT-08, API-CHAT-09, API-CHAT-15, API-CAT-36, API-NOTIF-01, API-NOTIF-03, API-NOTIF-04, API-AUTH-03..06, API-AUTH-08, S-07 step 4 (customer view), S-15 (UI), S-21 step 1, docs/07 §4.7
- Description: `/account/invoices` (invoices + credit notes as presigned PDF links; payment attempts table), `/account/queries` + `[id]` (thread, reply with attachments via intents, reopen rule, status chips), `/account/chat` (menu buttons, free-text input, SSE streaming renderer with citations, fallback notices, cap notice, `lead_intent` confirm card whose submit calls `confirmLeadCapture` (API-CHAT-15) with editable prefilled fields, "Talk to a human" escalation, logged-out prompt on the site-level launcher), `/account/wishlist` (cards, remove, coming-soon "notify me"), `/account/notifications` (inbox, mark read/all), `/account/settings` (Profile; Settings: display currency, theme (flag), reduce motion; Security: change password ends other sessions, active session view, auth methods; Notifications prefs with locked `orderUpdates`; Delete account with `DELETE` phrase and warning about active subscriptions).
- Owned paths: `src/app/(account)/account/{invoices,queries,chat,wishlist,notifications,settings}/**`, `src/components/account/{InvoiceTable,QueryThread,ChatWidget,ChatLauncher,WishlistGrid,NotificationInbox,ProfileForm,SecurityPanel,DeleteAccountDialog}.tsx`. Forbidden: `src/modules/**`, `src/app/api/**`.
- Dependencies: P7.10; P4.5, P6.5, P6.6, P6.7, P6.1, P3.4, P3.6.
- Expected files/modules: as listed.
- Tests required: unit `tests/unit/components/account/{chat-widget-sse,query-thread,delete-dialog}.test.tsx`; e2e `tests/e2e/account/chat.spec.ts` (S-15 steps 1–6 UI with fake provider), `queries.spec.ts`, `invoices.spec.ts` (PDF link 302 to presigned), `settings.spec.ts` (currency/theme persist; password change ends other session; S-21 step 1), `notifications.spec.ts`, axe on every `/account/*` section both themes.
- Acceptance criteria:
  - [ ] S-15 UI steps pass; fallback and cap notices render
  - [ ] S-21 step 1: after delete, login refused and admin still sees orders (admin part asserted in P8)
  - [ ] invoices open through presigned URLs only
- Definition of Done: code + tests + PROGRESS row + CI green.
- Potential risks and mitigations: SSE rendering across browsers → `EventSource`-free `fetch` + `ReadableStream` parser with unit tests.

### P7.12 Performance budgets, customer e2e + axe suites, phase gate
- Owner profile: domain-standard + reviewer
- Requirement IDs: NFR-PERF-01, NFR-PERF-02, NFR-PERF-03, NFR-A11Y-01, FR-OPS-05, master plan §6 (P7 gate), docs/10 §8, §9, §13 (P7 row), docs/11 §B2, §B10
- Description: Enforce `lighthouserc.json` assertions from P1.9 on `/`, `/products`, `/products/<seeded>`, `/projects/<seeded>`, `/blog/<seeded>`, `/services`, `/contact`, `/legal/privacy` (mobile preset, 3 runs, median; `/` performance ≥ 0.85, others ≥ 0.90; LCP ≤ 2.5 s; CLS ≤ 0.1; TBT ≤ 300 ms; a11y/SEO ≥ 0.95; best-practices ≥ 0.90); finalise `.size-limit.json` budgets per docs/11 §B2 (public first-load ≤ 180 KB gzip excl. lazy chunks; `three-hero`, `chapter-scroller`, `pdf-viewer`); mount `WebVitals` verified; assemble `tests/e2e/customer/*.spec.ts` index running every customer journey of docs/10 §6 that P7 screens cover (S-01, S-02 1–3 & 6–8, S-03 3, S-06 2/6, S-07 1, S-08, S-09, S-14 1–3, S-15, S-16, S-17, S-18, S-21 1) in both themes and on mobile Chrome; axe on every public/auth/account route both themes + reduced-motion pass; visual baselines for the 12 key screens (nightly, informational). Write `implementation/reviews/P7-review.md`.
- Owned paths: `lighthouserc.json`, `.size-limit.json`, `tests/e2e/customer/**`, `tests/e2e/a11y/customer-routes.spec.ts`, `tests/e2e/visual/**`, `implementation/reviews/P7-review.md`. Forbidden: `src/**` (findings go to owners).
- Dependencies: P7.1–P7.11.
- Expected files/modules: as listed.
- Tests required: LHCI job green; `size-limit` green; the e2e/axe suites above.
- Acceptance criteria:
  - [ ] LHCI assertions pass on all eight URLs
  - [ ] `size-limit` passes for every entry
  - [ ] zero serious/critical axe violations on every customer route in both themes
  - [ ] review file with CI links
- Definition of Done: gates enforced in `ci.yml` (`lhci` required on site paths) + review + PROGRESS statuses + CI green.
- Potential risks and mitigations: LHCI against local `next start` slower than Vercel preview → thresholds identical, environment noted; flaky CWV → 3 runs median, `perf-exception` label not honoured (docs/10 §9).

## Parallelisation map

```
Agent A: P7.1 (B) ─► P7.2 ─► P7.3
Agent B: P7.1 ─► { P7.4 ‖ P7.5 ‖ P7.6 } ─► P7.7
Agent C: P7.1 ─► P7.8 ─► P7.9 ─► P7.10 ─► P7.11
All ──────────────────────────────────────► P7.12
```

- P7.1 is the only shared dependency; it merges first (agent B). Then three lanes run concurrently on disjoint directories: A in `(site)/page.tsx` + `components/{motion,three}`, B in `(site)/{services,projects,products,blog,contact,legal}` + `modules/seo`, C in `(auth)` + `(account)` + `components/account`.
- Shared component rule: `InquiryForm.tsx` is owned by A (P7.2) and consumed by B (P7.4, P7.6) — B waits for that single file or uses a stub prop interface agreed in P7.1.
- P7.4/P7.5/P7.6 are concurrent (different route folders). P7.7 last in lane B because it wires helpers into those pages.
- Lane C is sequential (each screen set builds on the previous shell). Lane C cannot start P7.9 before P4/P5/P6 are done; lane B needs only P3.
- P7.12 after everything; only it edits `lighthouserc.json`/`.size-limit.json` (P7.3 appends one entry — coordinate via orchestrator).

## Phase Definition of Done

- All 12 tasks `done`; `implementation/reviews/P7-review.md` committed.
- Every `SCR-SITE-*`, `SCR-AUTH-*`, `SCR-ACC-*` screen implemented with all documented states in both themes, using only `/dev/ui` components.
- CI green: unit component tests, e2e customer journeys listed in P7.12 (desktop + mobile Chrome), axe on all customer routes (both themes, reduced-motion pass), LHCI within budgets on the eight URLs, `size-limit` green.
- No route other than `/` ships GSAP; 3D chunk never requested on mobile/reduced motion/flag off.
- No doc corrections expected (URLs per MASTER_SPEC §7 / `ui/sitemap.md`; `src/modules/seo/**`, `src/app/(site|auth|account)/**`, `src/components/{site,account,motion,three}/**`, `sitemap.ts`, `robots.ts`, `api/og/**` are P7's per master plan §3).

## Phase risks

| Risk | Mitigation |
|------|------------|
| Landing fails CWV budget | poster-first hero, scrub-only GSAP, budgets gate; fallback: cut pinning/3D (founder decision) |
| UI drift from tokens | only `/dev/ui` components; hardcoded-colour lint; axe both themes |
| P4/P5/P6 late → lane C blocked | lanes A/B proceed on P3 alone; lane C starts with P7.8 (auth only) |
| Turnstile/CSP interplay | P9.1 CSP includes challenges.cloudflare.com; report-only on staging first |
