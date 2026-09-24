# SCR-SITE-09 — Contact / inquiry

**Route:** `/contact` · **Render:** SSG shell + client form · **App:** Site

## Purpose
The single public contact surface: an inquiry form that creates a lead (`source='inquiry_form'`). No email address, phone, WhatsApp or social links appear anywhere on the page (D-808). Visitors who need support (not sales) are told to sign in and open a query.

## User/role
Visitor, Customer (prefilled).

## Entry points
Header "Contact", footer, landing "Start a project" (opens the `InquirySheet`, which posts to this page's `createLead` action — MASTER_SPEC §7), services/case-study CTAs (sheet variant), 404 page, chatbot "Contact" menu (escalation to a query instead, for customers).

## Layout
- **Desktop:** Two columns.
- Left (40 %): h1 "Start a project", supporting copy ("Tell us what you're building. We reply by email within 2 working days."), three trust lines (e.g. "Fixed-scope proposals", "Indian and international clients", "NDA on request") from `site_settings.contact_blurbs`, and a small card "Already a customer? Sign in and open a query for order help" → `/account/queries`.
- Right (60 %): the form card: Full name*, Work email*, Company (optional), What do you need?
- (multi-select of services), Budget hint (optional select: "< ₹1 lakh", "₹1–5 lakh", "₹5–20 lakh", "> ₹20 lakh", "Not sure"), Message* (textarea, 2000 chars, counter), consent line "By sending you agree to our Privacy policy", invisible Turnstile, primary "Send inquiry".
- Footer.
- **Phone:** single column, copy first, form full width, sticky submit not needed (short form).

## Components
`Form`, `Input`, `Textarea`, `Select`, `Command`-based multi-select (`MultiSelect`), `Checkbox` (none), `Button`, `Card`, `Alert`, Turnstile widget, `Toast` (not used; inline success).

## Content & copy notes
- No contact details anywhere (D-808).
- No service prices (BR-01).
- Field error copy: "Enter a valid work email".
- Success copy: "Thanks, <name>. Your inquiry is in — we'll reply to <email> within 2 working days." with a reference "Inquiry #<short id>" and links "Browse products" / "See our work".
- Budget options are hints, never commitments.

## Interactions
- Validation on blur; submit → Turnstile token → `createLead` (API-LEAD-01); rate-limited per IP (D-1204); duplicate submit within 10 min from same email shows "We already have your inquiry — we'll be in touch".
- Customer signed in: name/email prefilled and locked (edit via settings); the lead links `user_id`.
- Analytics `inquiry_submitted` (`source='inquiry_form'`).

## States
- **Default:** empty form.
- **Loading:** submit button spinner; fields disabled.
- **Empty:** n/a.
- **Error:** validation errors inline; Turnstile failure "We couldn't verify your browser — please try again"; Turnstile outage → the form fails closed (submit disabled, `Alert` "Our form protection is temporarily unavailable — please try again shortly", MASTER_SPEC §7 "Turnstile outage"); server error `Alert` with retry preserving values; rate-limited "Too many attempts — try again in a few minutes".
- **Success:** form replaced by success panel (focus moved to its heading).
- **Permission-denied:** n/a.

## Responsive behaviour
xs–md single column; lg+ 40/60; tv max 1440 px centred, larger inputs (56 px).

## Accessibility
- All labels visible; required indicated with text "(required)" for screen readers and "*" visually; error summary `role="alert"` at top listing fields; multi-select is a Radix popover listbox with keyboard support; Turnstile invisible mode has an accessible fallback challenge; success panel announced.

## Motion
- Form card fade-in 200 ms; success panel cross-fade 200 ms. **Reduced motion:** none.

## Navigation
→ `/account/queries` (customers), `/products`, `/projects`, `/legal/privacy`.

## Data dependencies
Tables: `T-leads`, `T-lead_activities`, `T-services` (options), `T-site_settings`, `T-users` (prefill), `T-analytics_events`, `T-notifications` (admin "New lead" in-app alert).
Actions: `createLead` (API-LEAD-01). Queries: `listServices` (API-CONT-09).

## Requirement IDs
D-808, D-704, D-705, D-707, D-1204, D-1302, BR-01, BR-03, A-1301.
