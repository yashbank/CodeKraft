# SCR-SITE-06 — Case study detail

**Route:** `/projects/[slug]` · **Render:** ISR (tag `content`) · **App:** Site

## Purpose
Tell one client project story — problem, solution, tech stack, results, images — with its own URL for SEO and sharing (D-803), and convert readers into project inquiries.

## User/role
Visitor, Customer.

## Entry points
Case studies list, landing Proof chapter, OG/social shares, search engines, chatbot answers.

## Layout
- **Desktop:** Breadcrumb (Projects › Title).
- Header: industry chip, h1 title, client name line ("for Acme Ltd" or "for a confidential client"), tech stack chips.
- Cover image full content width (21:9).
- Article body in a 720 px measure with a sticky right rail (280 px) containing: "At a glance" card (industry, tech stack, timeline if provided in `results_json`, key results as 2–3 big numbers) and CTA "Start a similar project".
- Sections in order with h2: Problem, Solution, Results (rich text; results also as stat tiles), Gallery (`Carousel` of images with captions).
- Bottom: "Next project" card pair (previous/next by date) and the inquiry band.
- Footer.
- **Phone:** rail content moves below the header as a compact card; body full width; gallery swipe; next/previous stacked.

## Components
- shadcn/ui: `Breadcrumb`, `Badge`, `Card`, `Carousel`, `Dialog` (image lightbox), `Button`, `Sheet` (inquiry)
- custom: `StatTile`, `RichText`, `PrevNextNav`, `InquirySheet`.

## Content & copy notes
- Rich text from `problem_json`, `solution_json`, `results_json` (Tiptap → sanitised HTML).
- Stat tiles read a `metrics` array in `results_json` if present.
- No partner attribution (D-116).
- CTA copy "Start a similar project" opens the inquiry sheet with `message` prefilled "I'm interested in something like <title>".

## Interactions
- Gallery image click → lightbox with prev/next, Esc closes.
- CTA → `InquirySheet` (`source='inquiry_form'`, `service_interest` empty, message prefilled).
- Prev/next navigate between published case studies.

## States
- **Default:** published case study.
- **Loading:** static.
- **Empty:** no gallery → section omitted; no metrics → rail shows only chips + CTA.
- **Error:** unpublished/unknown slug → 404.
- **Success:** inquiry success in sheet.
- **Permission-denied:** n/a.

## Responsive behaviour
xs–md single column, rail below header; lg+ two-column with sticky rail; 2xl/tv body measure 840 px, cover max height 720 px.

## Accessibility
- Article uses `<article>` with `h1` then `h2` sections; stat tiles include the metric label in text; lightbox is a labelled dialog with focus trap; carousel has prev/next buttons and slide status.
- Images require alt text (enforced in admin).

## Motion
- Stat count-up 600 ms once; images fade-up on reveal. **Reduced motion:** static values, no reveals.

## Navigation
→ `/projects`, adjacent case studies, `/contact`, `/services`.

## Data dependencies
Tables: `T-case_studies`, `T-slug_redirects` (301 for old slugs), `T-media`, `T-leads` (write).
Queries: `getCaseStudyBySlug` (API-CONT-09), `listCaseStudies` adjacent (API-CONT-09). Actions: `createLead` (API-LEAD-01).

## Requirement IDs
D-803, D-1106, D-116, D-808, A-1301, D-704.
