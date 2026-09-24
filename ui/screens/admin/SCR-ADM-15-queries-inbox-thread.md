# SCR-ADM-15 — Queries inbox + thread

**Route:** `admin.<domain>/queries?status=&source=&assigned=&q=` and `/queries/[queryId]` · **Render:** Client · **App:** Admin

## Purpose
Support inbox for customer and visitor queries: form submissions, chatbot escalations, order-page requests (including refund requests), dashboard queries, and requests that arrived by email (via the invoice contact details) or were taken manually, which admins log here (`queries.source = email | manual`, docs/05 T-queries) (D-702). Admins claim from the shared pool, reply in-thread (customer sees it in their dashboard and by email), set status, and link to orders/refund proposals.

## User/role
Admin, Super Admin (`queries.read`, `queries.reply`, `queries.close`).

## Entry points
Sidebar "Queries" (badge open count), notifications "New query" / "Customer replied", dashboard "Open queries", order detail linked queries, customer detail.

## Layout
- **Desktop:** Two-pane.
- Left pane (380 px): h1 "Queries", status `Tabs` (Open, Waiting on customer, Resolved, Closed), filters (Source: Form / Chatbot / Order / Dashboard / Email / Manual; Assigned: Me / Pool / anyone), search; "Log a query" button (sheet: customer `Combobox` or guest email, subject, message, source Email / Manual, related order); list rows: subject, customer name/email (or "Visitor · email"), source icon, last message snippet, age, assignee avatar, unread dot.
- Right pane: thread header (subject h1, status badge, source, related chips: Order CK-…, Product, Entitlement, Lead, Conversation; assignee `Combobox`; buttons "Resolve", "Close", "Reopen"; ⋯ Propose refund (when order linked), Create lead, View customer).
- Messages (`role="log"`): customer bubbles left, admin right with admin name, system messages centred (escalation summary, refund status). **Chatbot context** collapsible showing the transcript excerpt for escalations.
- Composer: Tiptap-lite (bold, lists, links), attachments (3 × 10 MB), "Reply" (sets `waiting_customer`), "Reply & resolve", internal note toggle (visible to admins only, stored as `author_kind='admin'` with `meta.internal=true`, never emailed).
- **Phone / tablet (< lg):** not a supported layout — the admin app is designed for ≥ 1024 px (MASTER_SPEC §7 "Admin minimum width"). Below `lg` this screen renders the read-only "Open on a laptop" notice (docs/07 §3.4): page title, a one-line summary where cheap, links to Approvals and Notifications; no forms, tables or actions.

## Components
- shadcn/ui: `Tabs`, `Input`, `Select`, `Combobox`, `Badge`, `Avatar`, `ScrollArea`, `Collapsible`, `Button`, `DropdownMenu`, `Dialog`, `Textarea`/Tiptap, `Toggle` (internal note), `Skeleton`
- custom: `QueryListRow`, `MessageBubble`, `AttachmentChip`, `RelatedChips`.

## Content & copy notes
- Refund-request threads open with a system card: order, payment method, amount, product refundability, "Propose refund" button (creates the dual-approved request, BR-09/BR-13) and later "Refund approved — credit note CN/…".
- Visitor queries (no account) show "Replies go to <email> only" (no dashboard).
- Canned replies `Popover` with 5 admin-editable snippets (stored in `site_settings.query_snippets`).

## Interactions
- List via `listQueriesAdmin` (API-CHAT-04), polling 10 s; unread computed per admin.
- Assign/claim → `assignQuery`; Resolve/Close/Reopen → `closeQuery`/`reopenQuery` (API-CHAT-05).
- Reply → `replyToQuery` (API-CHAT-03) → email + in-app notification to customer (D-1002); optimistic bubble.
- Propose refund → SCR-ADM-07 refund dialog inline (API-PAY-05) with `queryId`.
- Create lead from query → `createLeadManual` prefilled (API-LEAD-02).
- Log a query → `createQueryAdmin` (API-CHAT-14) with `source='email'|'manual'`, optional `refundRequest` for emailed refund requests (MASTER_SPEC §7 "Refund request channel").
- Keyboard: J/K navigate list, R focuses composer.

## States
- **Default:** Open tab, oldest-unanswered first.
- **Loading:** skeleton list / bubbles.
- **Empty:** "Inbox zero — no open queries".
- **Error:** send failure keeps draft; attachment errors.
- **Success:** toasts "Reply sent — customer emailed".
- **Permission-denied:** reply/close gated; read-only view otherwise.

## Responsive behaviour
- **< lg (phone, tablet):** read-only "Open on a laptop" notice (admin minimum width 1024 px, MASTER_SPEC §7; founder may override).
- **lg+:** lg list 320 px + thread; xl+ 380 px + thread; tv wider bubbles.

## Accessibility
- Thread `role="log"` polite; internal notes visually distinct and announced "Internal note"; composer labelled; list rows are links with full names; status changes announced.

## Motion
- New message fade 150 ms; pane switch 150 ms.
- Reduced motion: none.

## Navigation
→ `/queries/[id]`, `/orders/[id]`, `/customers/[id]`, `/leads/[id]`, `/chatbot?tab=conversations&id=`, `/approvals/[id]`.

## Data dependencies
Tables: `T-queries`, `query_messages`, `T-users`, `T-orders`, `T-payments`, `T-refunds`, `T-products`, `T-entitlements`, `T-leads`, `T-conversations`/`T-chat_messages`, `T-media`/`files_upload_intents`, `T-notifications`, `email_outbox`, `T-site_settings` (snippets), `T-audit_logs`.
Queries: `listQueriesAdmin`/`getQueryAdmin` (API-CHAT-04), `getTranscript` (API-CHAT-11). Actions: `replyToQuery` (API-CHAT-03), `assignQuery`/`closeQuery`/`reopenQuery` (API-CHAT-05), `createQueryAdmin` (API-CHAT-14), `proposeRefund` (API-PAY-05), `createLeadManual` (API-LEAD-02), `createUploadIntent` (API-CAT-21).

## Requirement IDs
D-702, D-705, D-707, D-1002, D-505, BR-09, BR-13, D-704, D-1503, D-1104, D-015.
