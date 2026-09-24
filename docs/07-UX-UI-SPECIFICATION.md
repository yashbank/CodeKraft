# 07 — UX / UI SPECIFICATION

**Implements:** `MASTER_SPEC.md` §3–§4, baseline §3, §5–§16, `docs/04-SOLUTION-ARCHITECTURE.md` §5, §7.5, §7.6, §8, `docs/05-DATABASE-DESIGN.md`.
**Feeds:** `docs/08-DESIGN-SYSTEM.md`, `docs/10-QA-TEST-STRATEGY.md`, `docs/11-SEO-PERFORMANCE.md`, `ui/*`, `implementation/`.
**Companion files:** `ui/sitemap.md`, `ui/screens/user/*.md`, `ui/screens/admin/*.md` (one file per screen; every screen file uses the same fourteen headings).

This document is the master UX specification. It defines the information architecture, the navigation model of the three apps, the global interaction patterns every screen inherits, the responsive and accessibility rules, the motion principles, and the complete screen inventory. Anything not stated in a screen file is governed by this document; anything not stated here is governed by `docs/08-DESIGN-SYSTEM.md` (tokens, component visuals, both themes).

---

## 1. Design principles

1. **Premium first, accents second** (R-901). Generous whitespace, large type, restrained colour, one accent gradient per theme. Playfulness appears only in micro-interactions and copy, never in layout.
2. **Every state is designed.** Default, loading, empty, error, success and permission-denied are specified for each screen. No screen may show a blank region while data loads (skeletons, not spinners, for content; spinners only inside buttons).
3. **Manual payment is a feature, not an apology.** The UPI/bank flow (D-501) is explained step by step with a visible "what happens next" timeline; the customer is never left wondering whether the order went through.
4. **Admins act with confidence.** Every destructive or approval-gated action (BR-13) previews its consequence, names the approver, and shows the audit trail afterwards (D-1104).
5. **Buyers never see ownership** (BR-02, D-116). No partner name, split, or "sold by" appears anywhere in `(site)`, `(auth)` or `(account)`.
6. **No public contact details** (D-808). The only contact surface is the inquiry form. Footer has no email, phone, WhatsApp or social icons.
7. **Themes are tokens** (D-011). Screens are specified once; both Theme 1 (Dark cinematic) and Theme 2 (Light editorial, V1.1, flagged) render the same structure.
8. **Motion is meaning** (D-904, D-907). Motion communicates hierarchy, continuity and progress; it is never required to understand a screen and is fully replaced under reduced motion.

---

## 2. Information architecture

### 2.1 Three apps, one codebase

| App | Route group | Host | Audience | Rendering | Auth |
|-----|-------------|------|----------|-----------|------|
| **Site** | `(site)` + `(auth)` | `<domain>` | Visitor, Customer | SSG/ISR/SSR (A-1301) | Public (auth pages public) |
| **Account** | `(account)` | `<domain>/account/*`, `<domain>/checkout/[offeringId]`, `<domain>/quote/[token]` | Customer | SSR shell + client-heavy | Customer role, verified email for purchase (D-1201); `/quote/[token]` requires login and is read-only unless the session user is the invited customer (MASTER_SPEC §7, docs/06 API-COM-10) |
| **Admin** | `(admin)` | `admin.<domain>/*` | Admin, Super Admin | SSR shell + client-heavy | Admin/Super Admin role; optional TOTP (D-1202); 30-min idle (D-1203) |

The admin app is served by host rewrite (docs/04 §8): the request host is matched **exactly** against the `ADMIN_HOST` env value (a second `*.vercel.app` project hostname during the interim, `admin.<domain>` once the domain exists — MASTER_SPEC §7 "Admin host during interim"); `admin.<domain>/orders` → `(admin)/orders`. On the main host `/admin/*` is a 404. Sessions are separate per host.

### 2.2 Site IA (public)

```
/                       Landing — five story chapters (D-801)
/services               Services — one section per service (D-806)
/products               Products list — search, filters, sort (D-310, A-303)
/products/[slug]        Product detail — offerings, media, FAQs, testimonials, changelog, blog (D-121, D-313, D-805)
/projects               Case studies grid (D-803)
/projects/[slug]        Case study detail
/blog                   Blog index — product blog teasers only (D-804)
/blog/[slug]            Product blog post
/contact                Inquiry form only (D-808)
/legal/privacy | terms | refunds | license   (D-807)
/auth/login | register | verify | reset | otp (otp behind feature flag, D-1603)
```

### 2.3 Account IA (customer dashboard, D-1001)

```
/account                       Overview
/account/purchases             Purchases & access (entitlements)
/account/purchases/[id]        Entitlement detail (per delivery type)
/account/orders/[id]           Order status (pending payment, submit reference, retry)
/checkout/[offeringId]         Checkout (single offering, "Buy now", ADR-12) — in the (account) group, auth required, minimal account shell (MASTER_SPEC §7 "Auth and checkout URLs")
/quote/[token]                 Custom quote pay page (D-520) — login required; read-only unless signed in as the invited customer
/account/invoices              Invoices & payment history
/account/queries               Queries & conversations (+ /account/queries/[id])
/account/chat                  Chatbot (login required, D-205)
/account/wishlist              Wishlist (D-311)
/account/notifications         Notification inbox
/account/settings              Profile · Settings (currency, theme) · Security · Delete account
```

### 2.4 Admin IA (admin.<domain>)

```
/login  /login/totp
/dashboard                          Widget dashboard (D-120)
/approvals                          Approvals inbox (A-1101)
/notifications                      Admin notification inbox (D-707)
/products  /products/new  /products/[id]?tab=…   Catalog + product editor (tabs)
/categories                         Categories & tags (D-303)
/coupons                            Coupons (A-401)
/orders  /orders/[id]  /orders/new  Orders, order detail, manual/project order (D-1107)
/quotes  /quotes/[id]               Custom quotes (D-520)
/customers  /customers/[id]         Customers (D-1108)
/entitlements  /delivery-tasks      Entitlements & delivery tasks (D-607)
/leads  /leads/board  /leads/[id]   Leads list, pipeline board, lead detail (D-703–D-706)
/queries  /queries/[id]             Query inbox + thread (D-702)
/chatbot  (tabs: conversations, usage, prompts)   (D-708, docs/04 §9)
/finance/ledger | allocations | partners | payouts | expenses | adjustments | reports | statements
/content/landing | services | case-studies | testimonials | logos | faqs | legal
/settings/general | currencies | tax | payment-methods | theme | ai | notifications | flags | retention
/audit                              Audit log (D-1104)
/admin-users                        Admin users & roles (BR-13)
```

---

## 3. Navigation model

### 3.1 Site header (all `(site)` pages)

- **Left:** CodeKraft wordmark (link to `/`). No founder/team links (D-103).
- **Centre (≥ lg):** Services · Products · Projects · Blog · Contact. `NavigationMenu` with underline-on-active. Products entry shows a compact panel (top-level categories + "All products" + 4 featured mini cards, docs/08 §6.4 — no mega menu) on hover/focus; on touch a tap opens it, a second tap navigates.
- **Right:** Currency selector (§4.3) · Theme toggle (§4.2) · Auth control: "Sign in" button (Visitor) or avatar `DropdownMenu` (Customer: Dashboard, Purchases, Queries, Settings, Sign out).
- **Phone/tablet (< lg):** wordmark left, currency+theme collapsed into the menu, hamburger right opens a full-height `Sheet` from the right with the five links, currency and theme rows, and the auth control. Focus is trapped; Esc closes; returns focus to the hamburger.
- **Behaviour:** header is transparent over the landing hero and turns into a blurred glass bar after 80 px scroll; sticky on all other pages. Hides on scroll-down, reveals on scroll-up on phone only.
- **Skip link** "Skip to content" is the first focusable element on every page.

### 3.2 Site footer

Four columns on ≥ md, stacked on phone: (1) wordmark + one-line positioning + theme toggle; (2) Explore: Services, Products, Projects, Blog; (3) Company: Contact (inquiry form), Sign in; (4) Legal: Privacy, Terms, Refund & cancellation, Product license. Bottom row: © CodeKraft, governing law "India" (D-1504). **No email, phone, WhatsApp or social icons** (D-808). No newsletter box.

### 3.3 Account shell

- **Desktop (≥ lg):** left `Sidebar` (collapsible to icons) with Overview, Purchases & access, Invoices & payments, Queries, Chat, Wishlist, Notifications (badge), Settings. Top bar: breadcrumb, currency selector, theme toggle, notification bell, avatar menu. Content max-width 1200 px.
- **Phone:** top bar with back-chevron/section title, bell, avatar; bottom `Tab bar` with Overview, Purchases, Queries, Chat, More (opens a sheet with the remaining sections). Sidebar is not rendered.
- The site header is not shown inside `/account/*`; "Back to site" lives in the avatar menu and sidebar footer.

### 3.4 Admin shell

- **Desktop:** left `Sidebar` grouped: Overview (Dashboard, Approvals [badge], Notifications [badge]) · Catalog (Products, Categories, Coupons) · Commerce (Orders, Quotes, Customers, Entitlements, Delivery tasks) · Growth (Leads, Queries, Chatbot) · Finance (Ledger, Allocations, Partners & payouts, Expenses, Adjustments, Reports, Statements) · Content (Landing, Services, Case studies, Testimonials, Logos, FAQs, Legal) · System (Settings, Audit log, Admin users). Admin-role users (non-Super Admin) see only groups they have permission for (D-512).
- **Top bar:** global search (`Command` palette, ⌘K: products, orders by number, customers by email, leads by name), environment badge (staging/production), "Create" `DropdownMenu` (Product, Manual order, Quote, Lead, Expense), notification bell (§4.4), avatar (profile, TOTP setup, sign out). Idle-timeout warning `Dialog` appears at 28 min with "Stay signed in".
- **Tablet (md–lg):** sidebar collapses to icon rail with tooltips; tables switch to compact density.
- **Minimum width (MASTER_SPEC §7 "Admin minimum width"):** the admin app is designed for **≥ `lg` (1024 px)**. Below `lg` only three surfaces render a **read-mostly phone/tablet layout**: Approvals inbox (SCR-ADM-05: list + detail + Approve/Reject), payment confirmation (SCR-ADM-06 "Awaiting confirmation" queue and the SCR-ADM-07 Confirm-payment dialog; every other order action disabled) and the Notification inbox (SCR-ADM-33). Admin login (SCR-ADM-01) works at every width so those three are reachable. Every other admin screen below `lg` renders the **"Open on a laptop" notice**: page title, a one-line read-only summary where cheap (e.g. counts), links to Approvals and Notifications, and no forms, tables or actions. The sidebar becomes a `Sheet` listing only the three supported destinations. This narrows D-012 for the admin app; the founder may override.

### 3.5 Breadcrumbs

`Breadcrumb` on every account and admin page deeper than one level, and on product, case-study and blog detail pages (also emitted as JSON-LD BreadcrumbList, A-1301).

---

## 4. Global patterns

### 4.1 Page skeletons and loading

- Route-level `loading.tsx` renders `Skeleton` blocks matching the final layout (same heights) to keep CLS < 0.1 (D-1303).
- Data tables show 8 skeleton rows; cards show 3–6 skeleton cards; detail pages skeleton the header and first section only.
- Mutations show an inline spinner inside the triggering `Button` (disabled, `aria-busy`) — never a full-page overlay except checkout submission and payment confirmation, which use a blocking `Dialog` with progress text.

### 4.2 Theme toggle (D-905, D-011)

- `Switch`-style icon button (sun/moon glyph) in header, footer, account and admin top bars. Label "Theme: Dark cinematic / Light editorial".
- Sets `data-theme` on `<html>`, persists in a cookie (per device; visitors via `setVisitorPreferences`, API-AUTH-10) and, when signed in, in `users.theme_pref` (per account, `updateSettings` API-AUTH-04, which also refreshes the cookie). Default comes from `site_settings.default_theme`.
- Toggle is **rendered only when feature flag `theme_light_editorial` is on** (D-1602, MASTER_SPEC §7 "Theme toggle at launch"); at release 1 only Theme 1 is enabled, so the control is hidden. Theme 2 token CSS still ships in release 1 (docs/08 §4.1).
- No flash of wrong theme: an inline script applies the cookie before hydration.

### 4.3 Currency selector (D-111, D-502, D-518)

- `Select` with flag-less ISO codes: INR, USD, EUR, GBP, CAD. Shown in site header, account and site footers.
- Visitors: stored in the `ck_currency` cookie via `setVisitorPreferences` (API-AUTH-10; MASTER_SPEC §7 "Visitor currency selector"). Customers: stored in `users.display_currency` (API-AUTH-04) and synced across devices; logging in loads the account value and refreshes the cookie.
- Every price component renders `formatMoney(amount_minor, display_currency)` with the converted value; when converted (not an explicit `offering_prices` row) a `Tooltip`/footnote reads "≈ converted from INR at today's rate; you will be charged ₹X" (release 1 charges base currency).
- Checkout always displays the base-currency charge amount prominently and the display-currency equivalent secondarily.

### 4.4 Notification bell + inbox (D-707, D-1002, docs/04 §7.5)

- Bell icon `Button` with unread count `Badge` (99+ cap). `Popover` lists the 8 most recent with title, one-line body, relative time, unread dot; "Mark all read" and "View all" → inbox page.
- Admin shell polls every 10 s (focus refetch); a new unread row triggers a Sonner `toast` (top-right, 6 s, action link) and a subtle bell shake (disabled under reduced motion). Customer dashboard polls every 30 s; no toast, badge only.
- Inbox pages: list grouped by day, filter All/Unread, type chips, row click marks read and follows `link`. Persisted; nothing is auto-deleted.
- Email is a parallel channel for customers only (D-1002); admins never receive event emails (D-707) except the overdue follow-up daily digest (R-701).

### 4.5 Empty states

Illustration-free, token-coloured icon + title + one sentence + one primary action. Copy is specific: "No purchases yet — Explore products", "No leads match these filters — Clear filters", "Nothing awaiting your approval". Never "No data".

### 4.6 Error states

- Recoverable fetch errors: inline `Alert variant="destructive"` with "Try again" button in the affected region only.
- Form errors: field-level message under the input (`aria-describedby`), summary `Alert` at top of long forms listing errors with anchor links.
- Route errors: `error.tsx` with "Something went wrong" + retry + "Go to dashboard/home"; Sentry event ID shown in small text for support.
- Permission denied: `403` page "You don't have access to this" with link to the appropriate home; inside admin, an approval-gated action the actor cannot approve renders the button disabled with a `Tooltip` "Requires approval from another admin".

### 4.7 Forms

- react-hook-form + Zod, shared schema with the Server Action. Validate on blur, re-validate on change after first error. Submit disabled only while submitting, not while invalid (users must be able to click and see errors).
- Required fields marked with "*" and `aria-required`; optional fields say "(optional)" in the label.
- Unsaved-changes guard on admin editors: `AlertDialog` "Discard changes?" on navigation.
- Autosave for the product editor and content editors every 30 s and on tab switch, with "Saved 12 s ago" status text.
- Public forms carry an invisible Turnstile widget (D-1204); a failed challenge shows "We couldn't verify your browser — please try again".
- Money inputs: integer + decimal masked input, stored as minor units; currency shown as prefix adornment.
- Rich text: Tiptap editor toolbar (headings 2–3, bold, italic, lists, link, image, code, quote, table for legal pages). Output sanitised on server.

### 4.8 Tables (admin, account)

- TanStack + shadcn `Table`. Toolbar: search input, filter `Popover`s (faceted), column visibility, density, export CSV where specified. Sticky header. Row click opens detail; row actions in a trailing `DropdownMenu` (⋯).
- Pagination: server-side, 25 per page default (10/25/50/100), `Pagination` with page numbers on desktop, prev/next on phone.
- Bulk selection only where a bulk action exists (leads assign, notifications mark read, orders export).
- Phone: tables with more than 4 columns render as stacked `Card` rows with the same actions; column priority is stated per screen.

### 4.9 Modals, sheets, drawers

- `Dialog` for short, focused tasks (confirm payment, record payout, TOTP code). Max one level deep; never a dialog over a dialog — use inline steps.
- `Sheet` (right, 480–640 px) for secondary editing that keeps list context (edit offering, lead quick-view, widget settings). On phone sheets become full-screen `Drawer`s from the bottom.
- `AlertDialog` for destructive confirmations (§4.11).

### 4.10 Toasts

Sonner, bottom-right on desktop, top-centre on phone. Success 4 s, error persists until dismissed, with `aria-live="polite"`. Toast copy uses the canonical noun: "Order CK-ORD-000012 marked Paid", "Offering saved", "Approval sent to Priya".

### 4.11 Confirmations: destructive and approval-gated actions

| Class | Pattern |
|-------|---------|
| Reversible mutation | Immediate + toast with "Undo" where cheap (mark read, wishlist remove, widget remove) |
| Destructive, non-approval (delete draft, remove media, delete lead note) | `AlertDialog`: title names the object, body states consequence, destructive button labelled with the verb ("Delete draft") |
| Approval-gated (BR-13: publish, ownership change, project-order split (`project_order.split`, MASTER_SPEC §7), ledger adjustment, refund, payout, archive/delete product, admin user change) | Two-step: (1) `Dialog` "Request approval" showing a before/after diff or summary, required comment, list of approvers who must accept (all admins except requester); (2) on submit, toast "Approval requested" and an "Awaiting approval" `Badge` on the object with a link to the request. The approver sees the same diff in the Approvals inbox with Approve/Reject + comment. Requester's own Approve button is never rendered (docs/04 §7.4). |
| Financial confirmations (confirm payment, record received amount) | `Dialog` with a recap table (due, received, shortfall) and an explicit checkbox "I have verified this transfer in the bank/UPI app" before the primary button enables |
| Customer irreversible (cancel subscription, delete account) | `AlertDialog` requiring the user to type "CANCEL"/"DELETE" for delete account; plain confirm for cancel subscription (effect at period end, D-521) |

### 4.12 Status vocabulary (badges)

Colours are tokens; names are canonical (MASTER_SPEC §3). Orders: Pending payment · Paid · Fulfilled · Failed · Cancelled · Refunded · Partially refunded. Payments: Initiated · Submitted · Confirmed · Failed · Refunded. Entitlements: Pending · Active · Suspended · Expired · Revoked. Subscriptions: Trialing · Active · Past due · Suspended · Cancelled. Products: Draft · Pending approval · Scheduled · Published · Unpublished · Archived (+ flags Featured, Unlisted, Coming soon). Leads: New · Contacted · Qualified · Proposal · Won · Lost. Queries: Open · Waiting on customer · Resolved · Closed (source: Form · Chatbot · Order · Dashboard · Email · Manual). Approvals: Pending · Approved · Rejected · Applied · Cancelled (types: Publish · Ownership change · Ledger adjustment · Refund · Payout · Archive · Delete · Admin user change · Project order split). Full enum → chip map in docs/08 §6.8.

### 4.13 Money, dates, numbers

Money always with currency symbol/code and two decimals in the display currency, never floats in code. Dates as "24 Sep 2026" and relative in lists ("2 h ago", `title` shows absolute). Invoice numbers `CK/2026-27/0001` (BR-16); order numbers `CK-ORD-000001`.

### 4.14 Files

Upload via presigned PUT with progress bar, type/size validation messages before upload (A-1202). Downloads open a 5-minute signed link in the same tab; the button shows "Preparing…" then triggers, and the remaining-downloads counter updates (BR-15).

### 4.15 Search

Site search (products only, A-303) lives on `/products` as the page's search field, plus ⌘K in the account and admin shells. Results are server-side Postgres full-text (A-304); no type-ahead suggestions on the public site (INP budget).

### 4.16 Print, PDF and email

Invoices, credit notes, partner statements and every email are **always ink-on-white** (`#17181C` on `#FFFFFF`, mono wordmark), independent of the viewer's theme (MASTER_SPEC §7 "Print/PDF/email theming", docs/08 §3.3, §6.16). Web previews of these documents sit inside a themed frame but the sheet itself is unthemed. Print stylesheets on legal pages and reports strip navigation and chrome and render on white.

### 4.17 Slug changes

Slugs of published products, case studies and blogs may be changed by admins; the old slug is written to `slug_redirects` and served as a 301 (MASTER_SPEC §7 "Slug changes", docs/05 T-slug_redirects). Editors show a one-line notice when a published slug is edited.

---

## 5. Responsive breakpoints and behaviour (D-012)

| Token | Min width | Device | Layout rules |
|-------|-----------|--------|--------------|
| `xs` | 0 | Phone portrait (360–430) | Single column, 16 px gutters, bottom tab bar in account, hamburger nav, no 3D hero (static poster), simplified chapter motion (fade/translate only), sticky "Buy now" bar on product detail |
| `sm` | 640 | Phone landscape / small tablet | Two-column cards, same nav as xs |
| `md` | 768 | Tablet | Two/three-column grids, admin icon rail, product detail gallery beside summary, filter `Sheet` becomes inline sidebar on products list |
| `lg` | 1024 | Laptop | Full nav, account/admin sidebars, 3D hero eligible (if not low-power), tables full width |
| `xl` | 1280 | Desktop | Content max-width 1200 px (account/admin) / 1320 px (site); dashboard grid 12 columns |
| `2xl` | 1536 | Large desktop | Site max-width 1440 px; type scale +1 step via `clamp()`; product grid 4 columns |
| `tv` | 1920 | TV / 4K "10-foot" | Site max-width 1920 px with 96 px gutters; type scale +2 steps; all interactive targets ≥ 56 px; focus ring 4 px; hover-only affordances get always-visible equivalents; landing chapters fill the viewport; admin/account cap at `2xl` width and centre |

Admin app: the table applies from `lg` upward only; below `lg` see §3.4 (read-mostly layout for approvals, payment confirmation and notifications; notice elsewhere).

Additional rules: orientation-aware chapters (landscape phones render chapter media beside copy), `100dvh` for full-screen chapters, safe-area insets for bottom tab bars, pointer-coarse media query enlarges targets to 44 px minimum, hover cards degrade to tap-to-open. Images use `next/image` with `sizes` per breakpoint. Nothing is hidden at TV that exists on desktop.

---

## 6. Accessibility (WCAG 2.1 AA, D-907)

- **Structure:** one `h1` per page; landmarks `header/nav/main/aside/footer`; skip link; breadcrumbs with `aria-current="page"`.
- **Focus order** follows visual order; sheets/dialogs trap focus and restore it; custom components are Radix primitives (roving tabindex, arrow-key menus, Esc). Focus ring is a 2 px token-coloured outline plus 2 px offset, never removed; 4 px at `tv`.
- **Contrast:** text ≥ 4.5:1, large text and UI ≥ 3:1 in both themes; glass panels (Theme 1) must have a solid fallback colour under the blur to keep contrast measurable.
- **Motion:** `prefers-reduced-motion: reduce` disables GSAP scroll timelines, Lenis smooth scroll, parallax, 3D hero (static poster), bell shake, count-up numbers; transitions become opacity-only crossfades ≤ 200 ms or none (§7, MASTER_SPEC §7 "Reduced motion"). An in-app "Reduce motion" switch in Settings mirrors the OS preference for users whose OS lacks it.
- **Forms:** labels always visible (no placeholder-only labels), error text linked by `aria-describedby`, `aria-invalid`, live region announces submit results.
- **Tables:** `<th scope>`, caption or `aria-label`, sortable headers announce sort state; card-mode rows on phone keep the same reading order.
- **Media:** alt text mandatory in admin media uploads (form-level validation); video embeds require a title; the presentation viewer exposes page controls as buttons and a "Download PDF" alternative.
- **Charts (admin widgets):** each chart has a visually hidden data table and a text summary line; colour is never the only encoding.
- **Timeouts:** idle-timeout dialog gives ≥ 2 minutes warning and is dismissible by keyboard (WCAG 2.2.1).
- **Chatbot:** messages region `role="log"` `aria-live="polite"`; quick-reply menus are buttons in a `toolbar`; streaming text is announced when the message completes, not per token.
- **Language:** `lang="en"`; currency and dates localised via `Intl`.
- **Testing:** jsx-a11y lint, axe in Playwright on every screen ID in §8, manual keyboard pass on checkout, order confirm, product editor and dashboard grid (drag-and-drop has keyboard equivalents: move widget via arrow keys when focused on its handle).

---

## 7. Motion principles (D-904, D-907, D-1605)

| Principle | Rule |
|-----------|------|
| Scroll storytelling | Landing chapters use GSAP ScrollTrigger **pin-with-spacing at ≥ `lg` only** (`pinSpacing: true`, media column only) with `scrub`; below `lg` they are plain stacked sections. **No scroll-jacking**: no `scroll-snap-type` on chapters, no wheel capture, scroll position maps 1:1 to document position (MASTER_SPEC §7 "Scroll behaviour"). Animated properties are only `transform` and `opacity`; no layout properties; each chapter ≤ 1.5 viewport heights of scroll distance |
| 3D hero | react-three-fiber scene lazy-loaded after LCP via IntersectionObserver, only at ≥ `lg`, `pointer:fine`, `deviceMemory ≥ 4`, not `prefers-reduced-motion`, and feature flag `three_hero` on. Otherwise a static poster image (also the LCP element). Scene pauses when off-screen or tab hidden |
| Page transitions | None on public pages (SEO, INP). Account/admin route changes use a 120 ms fade of the content region only |
| Micro-interactions | Buttons: 100 ms colour, 1.02 scale on hover (fine pointers only). Cards: 200 ms translateY(−4px) + shadow. Badges/status changes: 200 ms colour cross-fade |
| Data motion | Count-up numbers on landing "Proof" chapter and admin stat widgets (600 ms), skipped under reduced motion |
| Feedback | Toast slide-in 200 ms; dialog scale 0.96→1 + fade 150 ms; sheet slide 250 ms |
| Reduced-motion variant | Everything above collapses to instant state changes or opacity-only crossfades ≤ 200 ms (docs/08 §7.4); landing chapters become normally scrolling stacked sections with static media; the sticky "story progress" rail remains as plain links |
| Mobile variant | No 3D, no pinning; chapters use simple `IntersectionObserver` fade-up (once) with `translateY(16px)`; Lenis disabled |
| Performance guard | Motion code split into `components/motion/*` loaded after hydration; animations must not run before first input is possible; Lighthouse CI enforces CWV budgets on `/`, `/products`, `/products/[slug]` |

---

## 8. Screen inventory

Screen IDs are cited by `docs/06` (API), `docs/10` (tests) and `implementation/`. "Render" = SSG/ISR/SSR/Client. Files live under `ui/screens/user/` and `ui/screens/admin/`.

### 8.1 Site (public)

| ID | Screen | Route | Render | Auth | File |
|----|--------|-------|--------|------|------|
| SCR-SITE-01 | Landing (story chapters) | `/` | ISR | Public | `ui/screens/user/SCR-SITE-01-landing.md` |
| SCR-SITE-02 | Services | `/services` | ISR | Public | `ui/screens/user/SCR-SITE-02-services.md` |
| SCR-SITE-03 | Products list | `/products` | SSR (filters) | Public | `ui/screens/user/SCR-SITE-03-products-list.md` |
| SCR-SITE-04 | Product detail | `/products/[slug]` | ISR | Public | `ui/screens/user/SCR-SITE-04-product-detail.md` |
| SCR-SITE-05 | Case studies list | `/projects` | ISR | Public | `ui/screens/user/SCR-SITE-05-case-studies-list.md` |
| SCR-SITE-06 | Case study detail | `/projects/[slug]` | ISR | Public | `ui/screens/user/SCR-SITE-06-case-study-detail.md` |
| SCR-SITE-07 | Blog index | `/blog` | ISR | Public | `ui/screens/user/SCR-SITE-07-blog-index.md` |
| SCR-SITE-08 | Blog post | `/blog/[slug]` | ISR | Public | `ui/screens/user/SCR-SITE-08-blog-post.md` |
| SCR-SITE-09 | Contact / inquiry | `/contact` | SSG + client form | Public | `ui/screens/user/SCR-SITE-09-contact.md` |
| SCR-SITE-10 | Legal page | `/legal/[key]` | ISR | Public | `ui/screens/user/SCR-SITE-10-legal-page.md` |
| SCR-SITE-11 | System pages (404, error, offline) | `not-found`, `error` | SSG | Public | `ui/screens/user/SCR-SITE-11-system-pages.md` |

### 8.2 Auth

| ID | Screen | Route | Render | Auth | File |
|----|--------|-------|--------|------|------|
| SCR-AUTH-01 | Login | `/auth/login` | SSR + client | Public | `ui/screens/user/SCR-AUTH-01-login.md` |
| SCR-AUTH-02 | Register | `/auth/register` | SSR + client | Public | `ui/screens/user/SCR-AUTH-02-register.md` |
| SCR-AUTH-03 | Verify email | `/auth/verify` | SSR | Public (token) | `ui/screens/user/SCR-AUTH-03-verify-email.md` |
| SCR-AUTH-04 | Reset password (request + set) | `/auth/reset` | SSR + client | Public (token) | `ui/screens/user/SCR-AUTH-04-reset-password.md` |
| SCR-AUTH-05 | Phone OTP (flag `phone_otp`) | `/auth/otp` | SSR + client | Public | `ui/screens/user/SCR-AUTH-05-phone-otp.md` |

### 8.3 Account (customer)

| ID | Screen | Route | Render | Auth | File |
|----|--------|-------|--------|------|------|
| SCR-ACC-01 | Overview | `/account` | Client | Customer | `ui/screens/user/SCR-ACC-01-overview.md` |
| SCR-ACC-02 | Purchases & access (list) | `/account/purchases` | Client | Customer | `ui/screens/user/SCR-ACC-02-purchases.md` |
| SCR-ACC-03 | Entitlement detail (per delivery type) | `/account/purchases/[id]` | Client | Customer | `ui/screens/user/SCR-ACC-03-entitlement-detail.md` |
| SCR-ACC-04 | Invoices & payments | `/account/invoices` | Client | Customer | `ui/screens/user/SCR-ACC-04-invoices-payments.md` |
| SCR-ACC-05 | Queries & conversations (list + thread) | `/account/queries`, `/account/queries/[id]` | Client | Customer | `ui/screens/user/SCR-ACC-05-queries.md` |
| SCR-ACC-06 | Chatbot | `/account/chat` | Client | Customer | `ui/screens/user/SCR-ACC-06-chatbot.md` |
| SCR-ACC-07 | Wishlist | `/account/wishlist` | Client | Customer | `ui/screens/user/SCR-ACC-07-wishlist.md` |
| SCR-ACC-08 | Notifications | `/account/notifications` | Client | Customer | `ui/screens/user/SCR-ACC-08-notifications.md` |
| SCR-ACC-09 | Profile & settings | `/account/settings` | Client | Customer | `ui/screens/user/SCR-ACC-09-profile-settings.md` |
| SCR-ACC-10 | Checkout | `/checkout/[offeringId]` | Client | Customer (verified) | `ui/screens/user/SCR-ACC-10-checkout.md` |
| SCR-ACC-11 | Order status | `/account/orders/[id]` | Client | Customer | `ui/screens/user/SCR-ACC-11-order-status.md` |
| SCR-ACC-12 | Custom quote pay page | `/quote/[token]` | Client | Customer (read-only unless the invited customer, verified) | `ui/screens/user/SCR-ACC-12-custom-quote.md` |

### 8.4 Admin (admin.<domain>)

| ID | Screen | Route | Render | Auth | File |
|----|--------|-------|--------|------|------|
| SCR-ADM-01 | Login + TOTP | `/login`, `/login/totp` | SSR + client | Public | `ui/screens/admin/SCR-ADM-01-login-totp.md` |
| SCR-ADM-02 | Widget dashboard + widget library | `/dashboard` | Client | Admin | `ui/screens/admin/SCR-ADM-02-dashboard.md` |
| SCR-ADM-03 | Products list (+ categories & tags) | `/products`, `/categories` | Client | Admin | `ui/screens/admin/SCR-ADM-03-products-list.md` |
| SCR-ADM-04 | Product editor (tabs) | `/products/new`, `/products/[id]` | Client | Admin | `ui/screens/admin/SCR-ADM-04-product-editor.md` |
| SCR-ADM-05 | Approvals inbox | `/approvals` | Client | Admin | `ui/screens/admin/SCR-ADM-05-approvals-inbox.md` |
| SCR-ADM-06 | Orders list | `/orders` | Client | Admin | `ui/screens/admin/SCR-ADM-06-orders-list.md` |
| SCR-ADM-07 | Order detail | `/orders/[id]` | Client | Admin | `ui/screens/admin/SCR-ADM-07-order-detail.md` |
| SCR-ADM-08 | Manual / project order creation | `/orders/new` | Client | Admin | `ui/screens/admin/SCR-ADM-08-manual-order.md` |
| SCR-ADM-09 | Custom quotes | `/quotes`, `/quotes/[id]` | Client | Admin | `ui/screens/admin/SCR-ADM-09-custom-quotes.md` |
| SCR-ADM-10 | Customers list | `/customers` | Client | Admin | `ui/screens/admin/SCR-ADM-10-customers-list.md` |
| SCR-ADM-11 | Customer detail | `/customers/[id]` | Client | Admin | `ui/screens/admin/SCR-ADM-11-customer-detail.md` |
| SCR-ADM-12 | Entitlements & delivery tasks | `/entitlements`, `/delivery-tasks` | Client | Admin | `ui/screens/admin/SCR-ADM-12-entitlements-delivery-tasks.md` |
| SCR-ADM-13 | Leads list + pipeline board | `/leads`, `/leads/board` | Client | Admin | `ui/screens/admin/SCR-ADM-13-leads-list-pipeline.md` |
| SCR-ADM-14 | Lead detail | `/leads/[id]` | Client | Admin | `ui/screens/admin/SCR-ADM-14-lead-detail.md` |
| SCR-ADM-15 | Queries inbox + thread | `/queries`, `/queries/[id]` | Client | Admin | `ui/screens/admin/SCR-ADM-15-queries-inbox-thread.md` |
| SCR-ADM-16 | Chatbot monitor | `/chatbot` | Client | Admin | `ui/screens/admin/SCR-ADM-16-chatbot-monitor.md` |
| SCR-ADM-17 | Finance: ledger | `/finance/ledger` | Client | Admin (`finance.ledger.read`) | `ui/screens/admin/SCR-ADM-17-finance-ledger.md` |
| SCR-ADM-18 | Finance: allocations | `/finance/allocations` | Client | Admin | `ui/screens/admin/SCR-ADM-18-finance-allocations.md` |
| SCR-ADM-19 | Finance: partner balances & payouts | `/finance/partners`, `/finance/payouts` | Client | Admin | `ui/screens/admin/SCR-ADM-19-finance-partners-payouts.md` |
| SCR-ADM-20 | Finance: expenses | `/finance/expenses` | Client | Admin | `ui/screens/admin/SCR-ADM-20-finance-expenses.md` |
| SCR-ADM-21 | Finance: adjustments | `/finance/adjustments` | Client | Admin | `ui/screens/admin/SCR-ADM-21-finance-adjustments.md` |
| SCR-ADM-22 | Finance: reports & statements | `/finance/reports`, `/finance/statements` | Client | Admin | `ui/screens/admin/SCR-ADM-22-finance-reports-statements.md` |
| SCR-ADM-23 | Content: landing chapters | `/content/landing` | Client | Admin | `ui/screens/admin/SCR-ADM-23-content-landing.md` |
| SCR-ADM-24 | Content: services | `/content/services` | Client | Admin | `ui/screens/admin/SCR-ADM-24-content-services.md` |
| SCR-ADM-25 | Content: case studies | `/content/case-studies` | Client | Admin | `ui/screens/admin/SCR-ADM-25-content-case-studies.md` |
| SCR-ADM-26 | Content: testimonials & client logos | `/content/testimonials`, `/content/logos` | Client | Admin | `ui/screens/admin/SCR-ADM-26-content-testimonials-logos.md` |
| SCR-ADM-27 | Content: FAQs | `/content/faqs` | Client | Admin | `ui/screens/admin/SCR-ADM-27-content-faqs.md` |
| SCR-ADM-28 | Content: legal pages | `/content/legal` | Client | Admin | `ui/screens/admin/SCR-ADM-28-content-legal.md` |
| SCR-ADM-29 | Settings (all tabs) | `/settings/*` | Client | Super Admin | `ui/screens/admin/SCR-ADM-29-settings.md` |
| SCR-ADM-30 | Audit log | `/audit` | Client | Admin | `ui/screens/admin/SCR-ADM-30-audit-log.md` |
| SCR-ADM-31 | Admin users & roles | `/admin-users` | Client | Super Admin | `ui/screens/admin/SCR-ADM-31-admin-users-roles.md` |
| SCR-ADM-32 | Coupons | `/coupons` | Client | Admin | `ui/screens/admin/SCR-ADM-32-coupons.md` |
| SCR-ADM-33 | Admin notification inbox | `/notifications` | Client | Admin | `ui/screens/admin/SCR-ADM-33-notifications-inbox.md` |

---

## 9. Cross-cutting requirement traceability

| Requirement | Where it lands |
|-------------|----------------|
| BR-02 / D-116 buyer never sees ownership | §1.5; all SITE/ACC screens omit partner data; product editor "Ownership" tab is admin-only |
| BR-03 login for purchase and chatbot | SCR-SITE-04 "Buy now" redirects to SCR-AUTH-01 with `returnTo`; SCR-ACC-06 under `(account)` |
| BR-10 no duplicate one-time purchase | SCR-SITE-04 shows "You own this" instead of Buy; SCR-ACC-10 blocks |
| BR-13 dual approval | §4.11; SCR-ADM-05; approval banners on SCR-ADM-04/07/19/21/31 |
| BR-14 manual renewal | SCR-ACC-03 subscription view; SCR-ACC-10 renewal mode |
| BR-15 download cap and signed links | §4.14; SCR-ACC-03 download view |
| BR-16 invoice numbering | SCR-ACC-04, SCR-ADM-07 |
| D-012 responsive to TV | §5 |
| D-120 / D-1101 widgets | SCR-ADM-02 |
| D-315 product CTA lead | SCR-SITE-04 "Request customisation" sheet |
| D-802 "Start a project" CTA | SCR-SITE-01 opens the `InquirySheet` (same `createLead` action as `/contact`, MASTER_SPEC §7); SCR-SITE-09 keeps the full-page form for SEO and deep links |
| BR-09 refund request channel | SCR-ACC-11 "Request refund" → query with `source='order'`; SCR-ADM-15 logs emailed requests as `source='email'` |
| MASTER_SPEC §7 admin minimum width | §3.4, §5; SCR-ADM-05/06/07/33 read-mostly phone layouts |
| MASTER_SPEC §7 print/PDF/email theming | §4.16 |
| D-707 admin in-app alerts | §4.4; SCR-ADM-33 |
| D-808 no public contact details | §3.1–3.2; SCR-SITE-09 |
| D-905 theme toggle | §4.2 |
| D-907 WCAG AA, reduced motion | §6, §7 |
| D-1001 dashboard sections | §2.3; SCR-ACC-01…09 |
| A-801 sitemap | `ui/sitemap.md` |

---

## 10. Open inconsistencies

All items previously listed here are resolved by `MASTER_SPEC.md` §7 or by the spine documents; the resolutions applied in this document are:

1. Resolved: theme toggle renders only when `theme_light_editorial` is on (§4.2; MASTER_SPEC §7 "Theme toggle at launch").
2. Resolved: auth routes are `/auth/login|register|verify|reset|otp` (§2.2; MASTER_SPEC §7 "Auth and checkout URLs", docs/04 §5).
3. Resolved: visitors pick a display currency stored in a cookie; login loads `users.display_currency` and saving it refreshes the cookie (§4.3; MASTER_SPEC §7 "Visitor currency selector").
4. Resolved: chatbot "Contact" quick reply escalates to a query (SCR-ACC-06; MASTER_SPEC §7 "Chatbot contact menu").
5. Resolved: widget library is 20 widgets (docs/04 §7.6 now lists 20; SCR-ADM-02).
6. Resolved: overdue follow-ups are a daily digest email to admins (R-701 in MASTER_SPEC §7; docs/06 cron `follow-up-digest`).
7. Resolved: a renewal order's `expires_at` equals `subscriptions.grace_until` (MASTER_SPEC §7 "Renewal order expiry"); SCR-ACC-03 shows one countdown.
8. Resolved: license key is revealed only inside the dashboard; email and in-app notification carry a link (MASTER_SPEC §7 "License key delivery"; SCR-ACC-03, SCR-ADM-07).
9. Resolved: Admin-role scope uses the permission strings and data scopes of docs/06 §1.2; screen files mark the scoped variant as "Admin-role filter".
10. Resolved: unlisted product live-demo URLs are an accepted residual risk; the product editor warns (MASTER_SPEC §7 "Unlisted product demo links"; SCR-ADM-04).
11. Resolved: checkout lives at `/checkout/[offeringId]` and custom quotes at `/quote/[token]` (MASTER_SPEC §7 "Auth and checkout URLs"); §2.3, §8.3, `ui/sitemap.md` and the screen files use these paths.
12. Resolved: `customer_profiles.notification_prefs jsonb` exists in docs/05 T-customer_profiles (SCR-ACC-09, API-NOTIF-04).
13. Resolved: refund requests open a query with `source='order'` from SCR-ACC-11; emailed requests are logged by admins with `source='email'` (docs/05 T-queries).
