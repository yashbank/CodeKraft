# SCR-SITE-05 — Case studies list

**Route:** `/projects` · **Render:** ISR (tag `content`) · **App:** Site

## Purpose
Proof of capability: a grid of published case studies (client projects) with industry and tech filters, each linking to its own detail page (D-803). Drives project inquiries.

## User/role
Visitor, Customer.

## Entry points
Header "Projects", landing Proof chapter cards and "See our work", services page band, footer.

## Layout
- **Desktop:** Hero band: h1 "Projects", one-line intro, primary "Start a project".
- Toolbar: filter chips for Industry (from distinct `case_studies.industry`) and Tech (from `tech_stack`), "All" default; sort fixed newest first.
- Grid 3-up of `CaseStudyCard`: cover image 4:3, client name (or "Confidential client" when blank), title, industry chip, up to 3 tech chips, one-line result highlight (first item of `results_json`).
- Client logo strip above the footer if logos exist.
- Footer.
- **Phone:** hero stacks, chips scroll horizontally, grid 1-up (2-up at sm), CTA full width.

## Components
- shadcn/ui: `Button`, `ToggleGroup`/`Badge` chips, `Card`, `Skeleton`
- custom: `CaseStudyCard`, `LogoStrip`.

## Content & copy notes
- Intro copy from `site_settings.projects_intro`.
- Never mention partners or which admin ran the project (D-116).
- Chip labels use the stored strings verbatim.
- Empty copy: "Case studies are being written — meanwhile, tell us about your project."

## Interactions
- Chip toggle filters client-side (list is small, < 50) and updates `?industry=`/`?tech=` for shareable URLs.
- Card click → detail. "Start a project" → `/contact`.

## States
- **Default:** published case studies newest first.
- **Loading:** skeleton grid of 6.
- **Empty:** no published case studies → hero + inquiry CTA + logo strip.
- **Error:** static content; no runtime fetch errors expected.
- **Success:** n/a.
- **Permission-denied:** n/a.

## Responsive behaviour
xs 1 col, sm 2, lg 3, 2xl/tv 4 columns with larger covers; chips wrap at ≥ md.

## Accessibility
- Chips are toggle buttons with `aria-pressed`; grid is a `<ul>` of `<li>`; card link wraps title with image alt from media; filter changes announce "8 projects shown" via live region.

## Motion
- Card lift on hover; grid cross-fade on filter 150 ms. **Reduced motion:** none.

## Navigation
→ `/projects/[slug]`, `/contact`, `/services`.

## Data dependencies
Tables: `T-case_studies`, `T-media`, `T-client_logos`, `T-site_settings`.
Queries: `listCaseStudies` (API-CONT-09), `listClientLogos` (API-CONT-09).

## Requirement IDs
D-803, D-117, D-1106, D-116, A-1301.
