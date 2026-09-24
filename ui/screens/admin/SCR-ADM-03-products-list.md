# SCR-ADM-03 — Products list (+ categories & tags)

**Route:** `admin.<domain>/products?status=&category=&q=` and `/categories` · **Render:** Client · **App:** Admin

## Purpose
Manage the catalog: find any product by status, category, flags or text; create new products; open the editor; request lifecycle changes (unpublish, archive, delete — the last two via approval, BR-11, BR-13). The companion `/categories` screen manages the two-level category tree and free-form tags (D-303).

## User/role
Admin (scoped to own products for write, all for read), Super Admin.

## Entry points
Sidebar "Products", dashboard "Catalog status counts", "Create › Product", approvals inbox links, order detail product links.

## Layout
- **Desktop:** h1 "Products" + status count chips (Draft 3 · Pending approval 1 · Scheduled 0 · Published 5 · Unpublished 1 · Archived 2) acting as filters.
- Toolbar: search, Category `Combobox`, Flags `Popover` (Featured, Unlisted, Coming soon, Refundable, Tax enabled), "New product" primary.
- `DataTable` columns: Thumbnail, Name (+ slug muted), Category, Status badge (+ "Awaiting approval" chip with link), Flags icons, Offerings (count + lowest base price), Version, Updated (relative, by whom), ⋯ actions: Edit, Preview (site, new tab; unlisted/draft via signed preview link), Submit for approval, Unpublish, Request archive, Request delete (only if zero orders), Duplicate as draft.
- Categories screen: two panes — left tree (`Collapsible` nodes, drag to reorder within level, max depth 2 enforced), right form for selected category (name, slug, description, parent) and a Tags section (`Badge` list with inline add/rename/delete, merge tool).
- Delete category blocked when products reference it.
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `DataTable` (TanStack), `Input`, `Combobox`, `Popover`, `Checkbox`, `Badge`, `Button`, `DropdownMenu`, `AlertDialog`, `Dialog` (request approval with comment), `Sheet`, `Collapsible`, `Skeleton`, `Pagination`
- custom: `StatusChips`, `CategoryTree`, `TagEditor`.

## Content & copy notes
- Status badge text per §4.12 of docs/07.
- Request delete dialog: "Delete <name>? This product has 0 orders, so deletion is allowed. Another admin must approve." Archive dialog: "Archive <name>? It has 4 orders, so it can't be deleted. Existing customers keep access. Another admin must approve." Buyers' view of ownership is never referenced here; ownership shows in the editor only.

## Interactions
- Filters and search update URL; server-side pagination (`listProductsAdmin`, API-CAT-18).
- Submit for approval → readiness check dialog listing failures (needs offering with base price and method, image, ownership summing 100%) → `submitForApproval` (API-CAT-11) with optional schedule date (D-307).
- Unpublish → `unpublishProduct` (API-CAT-13) with confirm.
- Request archive/delete → approval dialog → `requestArchive`/`requestDelete` (API-CAT-14).
- Categories: `upsertCategory`/`deleteCategory`/`upsertTag` (API-CAT-20).
- Row click → editor.

## States
- **Default:** all statuses except archived, updated desc.
- **Loading:** 8 skeleton rows.
- **Empty:** "No products yet — create your first product" / "No products match".
- **Error:** `Alert` + retry.
- **Success:** toasts "Submitted for approval — waiting for Priya", "Product unpublished".
- **Permission-denied:** Admin-role write actions disabled with tooltip on products they don't own; `catalog.read` only → view-only.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg+ full; tv wider thumbnails.

## Accessibility
- Table caption "Products"; status chips are toggle buttons with `aria-pressed`; row actions menu labelled "Actions for <name>"; tree uses `role="tree"` with arrow-key navigation and keyboard reordering (Alt+arrows).

## Motion
- Row hover highlight; sheet slide. **Reduced motion:** none.

## Navigation
→ `/products/[id]`, `/products/new`, `/approvals/[id]`, `/categories`, site preview.

## Data dependencies
Tables: `T-products`, `T-categories`, `T-tags`/`T-product_tags`, `T-offerings`, `T-offering_prices`, `T-product_media`/`T-media`, `T-product_ownerships`, `T-approval_requests`, `T-orders` (order count for delete eligibility), `T-audit_logs`.
Queries: `listProductsAdmin` (API-CAT-18), `listCategories` (API-CAT-32). Actions: `submitForApproval` (API-CAT-11), `unpublishProduct` (API-CAT-13), `requestArchive`/`requestDelete` (API-CAT-14), `upsertCategory`/`deleteCategory`/`upsertTag` (API-CAT-20), `createProduct` (duplicate, API-CAT-01).

## Requirement IDs
D-303, D-305, D-306, D-307, D-308, D-314, A-302, BR-11, BR-12, BR-13, D-1102, D-512, D-1104.
