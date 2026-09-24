# SCR-ACC-06 — Chatbot (assistant)

**Route:** `/account/chat?conversation=` · **Render:** Client (SSE via `POST /api/chat`) · **App:** Account · **Login required** (D-205, BR-03)

## Purpose
Hybrid assistant: quick-reply menus for common tasks resolved from the customer's own data without the LLM (order status, downloads, renewal, invoices, contact/talk to a human) plus free-text AI answers grounded only on site content (products, services, FAQs, legal). Escalates to a query thread when needed (D-701, D-702). Respects per-user and platform daily caps and falls back to menus (D-708).

## User/role
Customer with verified email. Visitors never see this screen (they get the inquiry form).

## Entry points
Sidebar/tab "Chat", overview "Ask the assistant", empty states ("Ask the assistant"), product page for signed-in users ("Questions? Ask the assistant" link), 404 page for customers.

## Layout
- **Desktop:** Account shell.
- Content is a chat panel (max 880 px, full height minus top bar): header row with "Assistant" title, usage chip "12 messages left today" (from `meta.usage`), "New conversation" and "History" (opens `Sheet` listing past conversations).
- Message list (`ScrollArea`): assistant bubbles left with CodeKraft mark, user bubbles right, **menu messages** rendered as a bubble with a row of quick-reply buttons (e.g. "Order status", "Downloads", "Renewal", "Invoices", "Talk to a human"), **data cards** for menu results (order status card with timeline; download card with file buttons that call the same download action; renewal card with "Renew"; invoice card with PDF link), **citations** row under AI answers ("From: FitDesk Pro · Refund policy") linking to the source page, and a persistent bottom "Menu" chip to return to quick replies.
- Composer: `Textarea` (auto-grow, 2000 chars), Send button, hint "Answers are based on CodeKraft's site content."
- **Phone:** full-screen panel under the top bar, composer sticky above the tab bar (tab bar hides while the keyboard is open), quick replies scroll horizontally.

## Components
- shadcn/ui: `ScrollArea`, `Textarea`, `Button`, `Badge` (usage), `Sheet` (history), `Card` (data cards), `Tooltip`, `Alert`, `Skeleton`
- custom: `MessageBubble`, `QuickReplies`, `OrderStatusCard`, `DownloadCard`, `CitationRow`, `TypingIndicator`.

## Content & copy notes
- Opening message: "Hi <name>. I can check your orders, downloads and renewals, or answer questions about our products and services. What do you need?" followed by the menu.
- Cap reached: "You've reached today's message limit. Quick actions still work, or talk to a human." Fallback (refusal/timeout/unavailable): "I can't answer that from our site content. Try one of these:" + menu.
- "Talk to a human" confirmation: "I'll hand this to the team as a query. Add a short summary?" The bot never invents prices; prices in answers come from retrieved offerings with the display-currency note.
- "Contact" intent never shows contact details (D-808) — it offers escalation.

## Interactions
- Mount → `startConversation` (API-CHAT-06) unless `conversation=` given; shows opening menu.
- Quick reply → `menuIntent` (API-CHAT-07) → menu/data bubbles; "back" returns to root menu.
- Free text → `POST /api/chat` (API-CHAT-08) streaming: typing indicator → deltas appended → citations → done; a `lead_intent` event renders a **confirmation card** (name, email prefilled and editable, "What do you need?") — no lead is written until the customer taps "Send to the team" → `confirmLeadCapture` (API-CHAT-15) → chip "We've noted your interest — the team will follow up" (D-701 lead capture, FR-CHAT-05).
- `fallback` event → fallback copy + menu; `reason:'limit'` disables composer until midnight (shows time).
- "Talk to a human" → optional summary dialog → `escalateConversation` (API-CHAT-09) → navigate to the new query thread with toast.
- History sheet → loads transcripts read-only; "Continue" starts a new conversation (no resume of old context).
- Analytics: `chat_started`, `chat_escalated`, `chat_lead_captured` (D-1302).

## States
- **Default:** opening message + menu.
- **Loading:** skeleton for history; typing indicator during stream; Send disabled while streaming (Stop button offered).
- **Empty:** no past conversations in history: "No previous conversations".
- **Error:** network drop mid-stream → partial message kept with "Connection lost — Retry"; 429 → "Slow down a little — try again in a minute"; unverified email → interstitial (SCR-AUTH-03 variant).
- **Success:** escalation toast "Query created".
- **Permission-denied:** visitor → login redirect; suspended → signed out.

## Responsive behaviour
xs full screen; md–lg panel 720 px; xl+ 880 px; tv 1100 px with larger bubbles; quick replies wrap at ≥ md.

## Accessibility
- Message list `role="log"` `aria-live="polite"`; streaming text announced on completion only; quick replies in a `toolbar` with arrow-key navigation; composer labelled "Message the assistant"; Stop button available during streaming; citations are links with source titles; usage chip text-based.

## Motion
- Typing indicator dots (disabled under reduced motion → static "Thinking…"); bubble fade-in 120 ms; smooth scroll-to-bottom (instant under reduced motion).

## Navigation
→ `/account/queries/[id]` (escalation), `/account/orders/[id]`, `/account/purchases/[id]`, `/products/[slug]` (citations), `/account/invoices`.

## Data dependencies
Tables: `T-conversations`, `T-chat_messages`, `chat_usage_daily`, `knowledge_chunks`, `prompt_versions`, `T-orders`, `T-entitlements`, `T-subscriptions`, `T-invoices` (menu data), `T-queries` (escalation), `T-leads` (capture), `T-analytics_events`.
Actions/queries: `startConversation` (API-CHAT-06), `menuIntent` (API-CHAT-07; `contact` resolves to escalation), `POST /api/chat` (API-CHAT-08), `escalateConversation` (API-CHAT-09), `endConversation`/`listMyConversations` (API-CHAT-10), `confirmLeadCapture` (API-CHAT-15), `issueDownloadLink` (API-DEL-02) from download cards.

## Requirement IDs
D-701, D-702, D-705, D-708, D-205, D-1503, D-1302, D-808, BR-03, X-002, X-010 (no live chat widget), D-1204.
