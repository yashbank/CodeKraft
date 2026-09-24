# SCR-ACC-05 — Queries & conversations (list + thread)

**Route:** `/account/queries?new=1&order=&entitlement=` and `/account/queries/[queryId]` · **Render:** Client · **App:** Account

## Purpose
The customer's support threads (queries) with admins, including threads escalated from the chatbot and refund requests raised from an order page. Customers read admin replies here and by email (D-702, D-1002). Also lists past chatbot conversations (read-only transcripts) since they are retained 12 months (D-1503).

## User/role
Customer.

## Entry points
Sidebar "Queries", overview "Open queries", email "CodeKraft replied to your query", chatbot "Talk to a human" escalation, order page "Request refund"/"Get help", entitlement "Open a query", legal pages, contact page (customers).

## Layout
- **List (desktop):** h1 "Queries".
- Toolbar: "New query" primary, filter `Select` (All / Open / Waiting on you / Resolved).
- Two sections via `Tabs`: **Queries** and **Chat history**.
- Queries rows: subject, last message preview, linked order/product chip, status `Badge` (Open / Waiting on you / Resolved / Closed), last activity time, unread dot.
- Chat history rows: date, first message preview, "Escalated" chip if applicable, "View transcript".
- **New query** `Sheet` (or full page on phone): Subject (`Input`), Related to (`Select`: None / Order CK-… / Purchase …, prefilled from params), Message (`Textarea`, 4000 chars), attachments (up to 3 files, 10 MB, images/PDF/zip), "Send".
- **Thread (desktop):** Breadcrumb (Queries › Subject).
- Header: subject h1, status badge, related chips (order/product/entitlement links), "Mark resolved" button (customer can resolve; cannot close).
- Message list: bubbles left (admin, labelled "CodeKraft") and right (you), system messages centred in muted text (e.g. "Escalated from assistant", "Refund approved"), attachments as chips with signed links, timestamps.
- Composer at bottom: `Textarea`, attach, "Send"; disabled with note when status Closed ("This query is closed — start a new one").
- **Phone:** list as cards; thread full screen with sticky composer above the bottom safe area; header collapses to back chevron + subject.

## Components
- shadcn/ui: `Tabs`, `Select`, `Button`, `Sheet`, `Form`, `Input`, `Textarea`, `Badge`, `Card`, `ScrollArea`, `Avatar`, `Skeleton`, `Alert`
- custom: `MessageBubble`, `AttachmentChip`, `FileDropzone`, `QueryRow`.

## Content & copy notes
- Admin replies are attributed to "CodeKraft" (with the admin's first name only, e.g. "CodeKraft · Priya") — no partner/ownership language.
- Reply-time expectation copy: "We usually reply within 1 working day." Refund requests created from an order page have subject "Refund request · CK-ORD-000012" and a system message listing the amount and policy ("This product is non-refundable; our team will review anyway").

## Interactions
- New query → `createQuery` (API-CHAT-01, `source='dashboard'` or `'order'`), attachments via upload intents; success → navigate to thread.
- Reply → `replyToQuery` (API-CHAT-03); status `waiting_customer` → `open`; optimistic bubble.
- Polling every 30 s for new admin messages (or on focus); new messages announced.
- "Mark resolved" → sets `status = resolved` on the customer's own thread (docs/06 API-CHAT-05 currently scopes `closeQuery` to admins; a customer `resolve` variant is required there — until it exists the button is hidden and customers ask the admin to resolve in-thread).
- Transcript view → read-only list; "Continue in assistant" starts a new conversation.

## States
- **Default:** list newest activity first.
- **Loading:** skeleton rows / bubbles.
- **Empty:** "No queries yet — ask the assistant or start a query" with both buttons.
- **Error:** send failure keeps text in composer with retry; upload errors per file.
- **Success:** toast "Query sent — we'll reply by email and here".
- **Permission-denied:** not owner → 404.

## Responsive behaviour
xs full-screen thread, list cards; md+ list table; lg+ thread max width 880 px; tv larger bubbles/type.

## Accessibility
- Thread as `role="log"` `aria-live="polite"`; each message has author + time in text; composer labelled; attachments announce type/size; sheet focus trap; unread indicator has text alternative.

## Motion
- New bubble fade-in 150 ms; sheet slide. **Reduced motion:** none.

## Navigation
→ `/account/queries/[id]`, `/account/orders/[id]`, `/account/purchases/[id]`, `/account/chat`.

## Data dependencies
Tables: `T-queries`, `query_messages`, `T-conversations`, `T-chat_messages`, `T-media`/`files_upload_intents`, `T-orders`, `T-entitlements`, `T-notifications` (admin `query.new`, customer `query.replied`), `email_outbox`.
Queries: `listMyQueries` / `getMyQuery` (API-CHAT-02), `listMyConversations` (API-CHAT-10). Actions: `createQuery` (API-CHAT-01), `replyToQuery` (API-CHAT-03), `createUploadIntent` (API-CAT-21).

## Requirement IDs
D-702, D-1002, D-1001, D-1503, D-705, D-707, BR-09, D-808, D-1204.
