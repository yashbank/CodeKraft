# SCR-ADM-04 — Product editor (tabs)

**Route:** `admin.<domain>/products/new`, `/products/[id]?tab=basics|content|media|offerings|delivery|ownership|seo|blog|versions|testimonials|faqs|publish` · **Render:** Client · **App:** Admin

## Purpose
The complete authoring surface for a product and everything hanging off it: identity and flags, rich content, media, offerings with prices and payment methods, delivery configuration per offering, ownership split (dual-approved), SEO, the product blog, versions and changelog, curated testimonials, FAQs, and the publish/schedule step. Products are never hardcoded (D-018).

## User/role
Admin (own products), Super Admin.

## Entry points
Products list row/"New product", approvals inbox "Open product", dashboard catalog widget, order detail product link.

## Layout
- **Desktop:** Sticky header: back link, product name (editable inline on Basics), status `Badge` + approval chip, autosave status ("Saved 12 s ago"), "Preview" (signed preview URL, new tab), "Submit for approval"/"Schedule" primary (Publish tab logic), ⋯ (Unpublish, Request archive/delete, Duplicate).
- Left vertical `Tabs` rail (220 px) with completeness ticks per tab; right form area (max 960 px).
- New product shows only Basics until first save.
- Tabs:
1. **Basics:** Name*, Slug* (auto from name, editable, uniqueness check; editing the slug of a `published` product shows "The old slug will redirect (301)" and writes `slug_redirects` on save — MASTER_SPEC §7 "Slug changes"), Short description* (160 chars), Category (`Combobox` two-level, D-303), Tags (`TagInput`), Status (read-only), Flags: Featured, Unlisted (direct link only), Coming soon (no buy button), Refundable, Tax enabled (D-314, D-415, D-504). Current version (read-only from Versions).
2. **Content:** Tiptap rich description*, repeatable lists: Features, Benefits, Target audience, Use cases; Industry (`TagInput`), Tech stack (`TagInput`), Requirements (rich text), Live demo URL (D-805) with the warning "A live-demo URL of an unlisted product is public once known" when `is_unlisted` (MASTER_SPEC §7 "Unlisted product demo links").
3. **Media:** upload dropzone (images, screenshots, gallery, video file ≤ 200 MB, presentation PDF, attachments) with kind `Select` per item, drag reorder, alt text* per image, OG image pick, video embed URL field (YouTube/Vimeo, D-309). Storage usage meter.
4. **Offerings & prices & payment methods:** table of offerings (name, purchase model, interval, base price, methods, status, default star) + "Add offering" → `Sheet`: Name*, Slug, Purchase model* (One-time / Subscription / Custom quote), Billing interval (subscriptions), Trial days, License type, Prices per enabled currency (base mandatory, compare-at optional, D-408), Enabled payment methods* (UPI, Bank transfer; gateways appear when flagged, D-110), Status, Is default.
5. **Delivery config:** per offering accordion: Delivery type* (SaaS / Hosted / Download / License / Service / Custom, D-008), Provisioning (Manual / Automated — automated disabled with "V2" tag unless flag), Access period (Lifetime / N months, D-605), Update policy (D-604), Download cap per purchase (download type, D-606), Release files picker (from Versions), Service checklist steps (service type: repeatable title + description, D-608), Post-purchase instructions rich text (A-601), Custom instructions.
6. **Ownership / split:** current active version card (company cut %, partner lines with %; effective from; version n), history table, "Propose new split" → form: Company cut (bps input as %), partner rows (`Combobox` partner + share %), live sum indicator must equal 100%, effective date, comment → creates approval request (BR-05). Pending proposal banner with approver name. Never visible to buyers (BR-02) — banner reminds editors.
7. **SEO:** SEO title (60-char meter), Meta description (160), Canonical URL, OG image override, JSON-LD preview (read-only), robots (`noindex` auto for unlisted).
8. **Blog:** Title, Slug (`/blog/…`; changing a published blog's slug writes `slug_redirects`), Excerpt, Cover, Tiptap body, SEO title/description, Status (Draft/Published) with "Publish blog" (requires product published; `content.publish`).
9. **Versions:** table (version, released, files, changelog); "Add version" → version string*, changelog rich text, release files upload; sets `current_version`; notifies owners per update policy on publish.
10. **Testimonials:** curated list (quote, author, title, company, avatar, published toggle), reorder (D-312).
11. **FAQs:** repeatable question/answer (rich), reorder; scope product (feeds chatbot knowledge).
12. **Publish / schedule:** readiness checklist (offering with base price and method ✔, ≥1 image ✔, ownership active or pending ✔, SEO title ✔ optional), "Publish at" date-time (optional, D-307), comment to approver, "Submit for approval" → approval request; shows current approval status/history; "Unpublish" for published; unlisted/coming-soon reminders.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Tabs`, `Form`, `Input`, `Textarea`, `Select`, `Combobox`, `Switch`, `Checkbox`, `DatePicker`, `Sheet`, `Dialog`, `AlertDialog`, `Accordion`, `Table`, `Badge`, `Button`, `Progress` (upload), `Tooltip`, `Alert`, `Skeleton`, Tiptap editor
- custom: `TagInput`, `MediaDropzone`, `MediaGrid`, `PriceMatrix`, `OwnershipForm`, `ReadinessChecklist`, `SlugField`, `CharCounter`.

## Content & copy notes
- Terminology enforced: "Offering" not "plan/tier"; "Ownership" not "revenue share"; percentages shown with two decimals, stored bps.
- Warnings: "Unlisted products are excluded from listings, search and sitemap"; "Coming soon hides the Buy button"; "Tax applies only once a GSTIN is configured in Settings" (BR-08).
- Delete offering blocked when entitlements exist ("Deactivate instead").

## Interactions
- Autosave every 30 s and on tab change (`updateProduct`, API-CAT-02); unsaved-changes guard.
- Media: `createUploadIntent` (API-CAT-21) → presigned PUT with progress → `attachProductMedia`/`reorder`/`detach` (API-CAT-06).
- Offerings: `upsertOffering`/`deleteOffering` (API-CAT-03), `setOfferingPrices` (API-CAT-04), `setOfferingPaymentMethods` (API-CAT-05).
- Ownership: `proposeOwnership` (API-CAT-16) → approval (sum must be 10000 bps; blocked if a pending version exists).
- Versions: `createProductVersion` (API-CAT-07); FAQs `upsertProductFaq` (API-CAT-08); testimonials (API-CAT-09); blog (API-CAT-10).
- Publish: `submitForApproval` (API-CAT-11, optional `publishAt`); `unpublishProduct` (API-CAT-13).
- Preview link opens site route with a signed preview cookie (drafts render for admins only).

## States
- **Default:** existing product loaded on last used tab.
- **Loading:** rail + form skeleton.
- **Empty:** new product — only Basics enabled; other tabs show "Save basics first".
- **Error:** field errors; slug conflict; upload rejected (type/size); `STATE_INVALID` on submit with readiness list; ownership sum error inline.
- **Success:** autosave status; toasts for offering saved, version added, approval requested (names the approver).
- **Permission-denied:** Admin-role on a product they don't own → read-only mode with banner; `content.publish` missing → blog publish disabled.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ rail 220 px + 960 px form; tv form 1100 px.

## Accessibility
- Tabs rail with arrow keys and completeness announced ("Basics, complete"); all uploads have alt-text fields (required for images); drag reorder has keyboard alternative (move up/down buttons); Tiptap toolbar buttons labelled; percent inputs announce running total; approval dialog explains who must approve.

## Motion
- Tab cross-fade 150 ms; upload progress bar; sheet slide. **Reduced motion:** none.

## Navigation
→ `/products`, `/approvals/[id]`, site preview, `/settings/tax`, `/admin-users` (partners).

## Data dependencies
Tables: `T-products`, `T-slug_redirects` (write on slug change), `T-categories`, `T-tags`/`T-product_tags`, `T-product_media`/`T-media`, `files_upload_intents`, `T-offerings`, `T-offering_prices`, `T-offering_payment_methods`, `T-product_ownerships`/`T-product_ownership_lines`, `T-partners`, `T-product_versions`, `T-release_files`, `T-product_faqs`, `T-product_testimonials`, `T-product_blogs`, `T-approval_requests`, `T-site_settings` (currencies, flags, GSTIN), `T-audit_logs`.
Queries: `getProductAdmin` (API-CAT-19), `listCategories` (API-CAT-32), `listPartners` (API-ADM-12). Actions: API-CAT-01…11, 13, 14, 16, 21.

## Requirement IDs
D-018, D-303, D-304, D-305, D-307, D-309, D-312, D-313, D-314, D-315, D-404, D-405, D-408, D-110, D-415, D-503, D-504, D-506, D-508, D-509, D-601–D-608, D-121, D-804, D-805, D-1102, A-301, A-302, A-601, BR-02, BR-05, BR-06, BR-07, BR-08, BR-12, BR-13, A-1301.
