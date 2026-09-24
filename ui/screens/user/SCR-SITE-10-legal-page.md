# SCR-SITE-10 — Legal page

**Route:** `/legal/[key]` where key ∈ `privacy | terms | refunds | license` · **Render:** ISR (tag `legal`) · **App:** Site

## Purpose
Publish the four legal documents (Privacy policy, Terms of service, Refund & cancellation policy, Product license terms — D-807) as admin-editable, versioned rich text with a clear "last updated" date and an in-page table of contents. Refund wording must state that refunds are never self-service and that gateway payments are non-refundable (BR-09, R-502).

## User/role
Visitor, Customer.

## Entry points
Footer links, checkout consent line, register consent line, contact form consent line, invoice PDF footer links, chatbot answers.

## Layout
- **Desktop:** Breadcrumb (Legal › Title).
- Header: h1 title, "Version 3 · Last updated 24 Sep 2026", a `Tabs`-style secondary nav switching between the four legal pages.
- Two columns: sticky left TOC (h2 anchors) 260 px; right body 760 px measure with numbered h2/h3 sections, tables (e.g. retention periods), definitions.
- Bottom: "Questions? Sign in and open a query" (no email, D-808) and governing-law line "These terms are governed by the laws of India" (D-1504).
- Footer.
- **Phone:** legal switcher as horizontal chips; TOC collapses into an `Accordion` "Contents" above the body.

## Components
- shadcn/ui: `Breadcrumb`, `Tabs` (as links), `Accordion` (phone TOC)
- custom: `TableOfContents`, `RichText`, `Button`.

## Content & copy notes
- Body from `legal_pages.body_json` (Tiptap) rendered server-side; heading ids generated from text for anchors.
- Privacy policy includes the cookie notice line (A-1501), AI provider transcript handling (docs/04 §9), retention (BR-18).
- Refund page mirrors per-product refundability flag language.
- License page describes update policies (D-604) and access periods (D-605).

## Interactions
- TOC anchor links; switcher navigates between keys; print stylesheet strips nav/TOC.
- "Open a query" → `/account/queries?new=1` (login redirect if signed out).

## States
- **Default:** latest published version.
- **Loading:** static.
- **Empty:** page not yet published → 404 with "This page is being prepared".
- **Error:** n/a.
- **Success:** n/a.
- **Permission-denied:** n/a.

## Responsive behaviour
xs–md single column; lg+ two-column with sticky TOC; tv measure 880 px.

## Accessibility
- Proper heading outline; TOC `nav aria-label="Contents"`; tables with `<th scope>`; `<time datetime>` for updated date; high-contrast body text; print friendly.

## Motion
- None.
- Reduced motion: none.

## Navigation
Between legal pages, → `/account/queries`, footer.

## Data dependencies
Tables: `T-legal_pages`.
Queries: `getLegalPage` (API-CONT-09).

## Requirement IDs
D-807, D-1504, D-808, BR-09, BR-18, R-502, A-1501, D-1106.
