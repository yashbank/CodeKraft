# SCR-SITE-02 — Services

**Route:** `/services` · **Render:** ISR (tag `content`) · **App:** Site

## Purpose
Present the studio's service lines (custom web apps, mobile apps, SaaS product development, website development, UI/UX design, AI integration, maintenance & support, consulting — admin-editable, D-302) on a single page with one section per service and an inquiry CTA. Services are sold by inquiry only; no pricing appears (BR-01).

## User/role
Visitor, Customer.

## Entry points
Header nav "Services", landing chapter 2 "See all services", footer, service card deep links (`/services#<slug>`), chatbot menu "Services".

## Layout
- **Desktop:** Page hero band: h1 "What we build", one-paragraph positioning, primary CTA "Start a project".
- Below, a two-column layout: left sticky in-page `TableOfContents` listing the services (anchor links, current highlighted via scroll spy); right a vertical stack of service sections.
- Each section (`<section id=slug>`): icon, h2 title, summary paragraph, "Deliverables" as a 2-column checklist, optional rich-text body, and a section CTA "Discuss this service" that opens the inquiry `Sheet` pre-filled with `service_interest`.
- Sections are separated by a hairline and 96 px spacing.
- After the last section: a "Not sure what you need?" band with the same CTA and a link to `/projects` ("See our work").
- Footer.
- **Phone:** hero stacks; TOC becomes a horizontal chip scroller under the sticky header; sections stack with 48 px spacing; deliverables become single column; CTA full width.

## Components
- shadcn/ui: `Button`, `Card` (service section container in Theme 1 as glass panel), `Sheet` (inquiry form), `Form`, `Input`, `Select` (multi via `Command`), `Textarea`, `Checkbox` list (deliverables read-only styled), `Separator`
- custom: `TableOfContents`, `ServiceIcon`, `InquirySheet` (shared with product CTA and contact page).

## Content & copy notes
- Titles, summaries, deliverables and body come from `services` (`published=true`, ordered by `position`).
- Hero copy is editable through `site_settings.services_intro`.
- CTA copy: "Start a project" (hero), "Discuss this service" (per section).
- Inquiry sheet subtitle: "Tell us about your project — we reply by email within 2 working days." No prices, no "starting at", no hourly rates (BR-01).
- No public contact details (D-808).

## Interactions
- TOC click → smooth scroll to section (instant under reduced motion), URL hash updates, focus moves to section heading.
- "Discuss this service" → `InquirySheet` with `service_interest=[slug]` pre-checked; user fills name, email, company (optional), message; Turnstile invisible; submit → `createLead` (API-LEAD-01, `source=inquiry_form`, `service_interest`); success view inside the sheet with "Done" button.
- Signed-in customers get name/email pre-filled and read-only-with-edit.
- Analytics: `inquiry_submitted` with `service_interest` prop.

## States
- **Default:** all published services.
- **Loading:** static; sheet submit shows button spinner.
- **Empty:** no published services → hero + single band "Tell us what you need" with inquiry CTA (admin seeded 8 services, so rare).
- **Error:** submit failure → inline `Alert` in sheet with retry; Turnstile failure message.
- **Success:** sheet success view; toast not used (sheet already confirms).
- **Permission-denied:** n/a.

## Responsive behaviour
xs–sm: chips TOC, stacked sections. md: TOC still chips; deliverables 2 columns. lg+: sticky TOC column 240 px. 2xl/tv: content max 1440/1920, type scale up, sticky TOC remains, sheet width 640 px.

## Accessibility
- `<nav aria-label="On this page">` for TOC with `aria-current`.
- Each service has a unique `h2` id.
- Deliverables list uses `<ul>` with check icons `aria-hidden`.
- Sheet traps focus, labelled by its heading, Esc closes and returns focus to the triggering button.
- Icons decorative.
- Scroll spy never steals focus.

## Motion
- Section reveal: fade-up 250 ms once on intersection; icon draws in (SVG stroke) 400 ms on first reveal at ≥ lg.
- Sheet slide 250 ms. **Reduced motion:** no reveal animation, no icon draw, sheet appears instantly, TOC scroll is instant.

## Navigation
→ `/contact` (same sheet form as full page), `/projects`, `/products`, landing. Hash links within page.

## Data dependencies
Tables: `T-services`, `T-site_settings` (intro copy), `T-leads` (write), `T-lead_activities` (system note), `T-analytics_events`, `T-users` (prefill).
Queries: `listServices` (API-CONT-09). Actions: `createLead` (API-LEAD-01).

## Requirement IDs
BR-01, D-105, D-302, D-806, D-808, D-1106, D-704, D-1204, D-1302, A-1301.
