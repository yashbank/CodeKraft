# 04 — SOLUTION ARCHITECTURE

**Implements:** `MASTER_SPEC.md` §4 rules; baseline §5–§16; NFRs in `docs/03-SRS.md`.
**Feeds:** `05-DATABASE-DESIGN`, `06-API-SPECIFICATION`, `09-SECURITY-DESIGN`, `12-DEVOPS-DEPLOYMENT`, `implementation/`.

---

## 1. Requirements that shape the architecture

| Driver | Requirement | Consequence |
|--------|-------------|-------------|
| SEO on public pages | A-1301, D-803, D-804 | Server-side rendering or static generation for site, products, case studies, blogs |
| Cinematic landing, 3D hero, scroll storytelling, CWV good | D-801, D-904, D-1303, D-1605 | React with a scroll-animation stack; lazy-loaded WebGL; heavy code split away from first paint |
| Two full themes as token systems | D-011, D-902, D-903, D-905 | CSS-variable design tokens, `data-theme` attribute, no theme branching in components |
| Manual payments now, gateways in a week | D-402, D-501, A-402 | Provider interface; `ManualProvider` first; webhooks later |
| Immutable partner ledger, dual approvals, project invoicing, expenses | BR-05–07, BR-13, BR-17, D-510, D-514 | Relational database with transactions and constraints; append-only journal |
| Delivery types resolved per offering | A-602, D-601–D-608 | Entitlement state machine with pluggable delivery handlers |
| Hybrid AI chatbot on site content with limits | D-701, D-708 | LLM adapter behind an interface; Postgres full-text retrieval; usage counters |
| Real-time admin notifications, persisted inbox | D-015, D-707 | Notifications table + short-interval polling (upgradeable to SSE) |
| Customizable widget dashboard | D-120, D-1101 | Widget registry + per-admin layout persisted as JSON |
| Vercel now, purchased hosting later | D-1401, D-1606 | Framework that runs both serverless and in a container; no Vercel-only primitives in domain code |
| Free tiers | D-1402, D-1403 | Neon/Supabase Postgres, Cloudflare R2, Resend, Umami, Turnstile, Sentry free tiers |
| Two founders + AI agents build it in days | D-119, D-021 | One language (TypeScript), one app, mainstream libraries with abundant training data, clear module boundaries |
| 1–30 orders/year, < 50 products | D-107, A-304 | No queues, no search engine, no microservices; Postgres does everything |

## 2. Constraints

- No legal entity yet; no gateway accounts (R-102). Manual payments only in release 1.
- Free-tier services with cold starts and size caps (R-1402).
- Founder timeline of days (R-103). Every choice must minimise integration risk.
- Admin app on a separate subdomain (A-1201) but must not double the build/deploy pipeline.
- WCAG 2.1 AA and reduced-motion (D-907).

## 3. Candidate architectures

| Option | Description | Perf/SEO | Security | Cost | Maintain | Scale | DevEx | AI-agent fit | Verdict |
|--------|-------------|----------|----------|------|----------|-------|-------|--------------|---------|
| **A. Next.js full-stack monolith** (App Router, Server Components, Route Handlers, Server Actions), Postgres, single deployable | One TypeScript codebase for site, account and admin; SSR/SSG built in | ★★★★★ | ★★★★ | ★★★★★ (free tiers) | ★★★★ | ★★★★ (far beyond need) | ★★★★★ | ★★★★★ (most-documented React stack) | **Selected** |
| B. React SPA (Vite) + separate Node API (NestJS/Fastify) | Two deployables, REST between them | ★★ (no SSR without extra work) | ★★★★ | ★★★★ | ★★★ | ★★★★ | ★★★ | ★★★★ | Rejected: SEO cost, two pipelines |
| C. Astro (public) + Next.js (app) | Best static performance for marketing pages | ★★★★★ | ★★★★ | ★★★★ | ★★ (two frameworks, shared themes duplicated) | ★★★★ | ★★ | ★★★ | Rejected: doubles theme/design-system work |
| D. Remix / React Router v7 full-stack | Similar to A with loaders/actions | ★★★★★ | ★★★★ | ★★★★★ | ★★★★ | ★★★★ | ★★★★ | ★★★ (less agent training data, fewer templates) | Rejected: weaker ecosystem for admin UI, PDF, auth plugins |
| E. Django/Laravel SSR + React islands | Mature back-end, server templates | ★★★ | ★★★★★ | ★★★★ | ★★★ | ★★★★ | ★★ (two languages) | ★★★ | Rejected: animation-heavy front end forces a full React layer anyway |
| F. BaaS (Supabase/Firebase) + Next.js front end | Auth, DB, storage bundled | ★★★★ | ★★★ (RLS-only business rules) | ★★★★★ | ★★ (ledger/approval logic in SQL policies or edge functions) | ★★★ | ★★★ | ★★★ | Rejected: dual-approval and ledger invariants are awkward outside application code; lock-in |

**Selection: A.** It is the only option that satisfies SEO, animation, one pipeline, free hosting today and container hosting next week, with the broadest library ecosystem for every required feature (auth with TOTP and OTP, PDF invoices, rich text, data tables, charts, drag-and-drop dashboards, 3D).

## 4. Selected technology stack

| Concern | Choice | Why this and not the alternative |
|---------|--------|----------------------------------|
| Runtime / language | Node 22 LTS, TypeScript strict, pnpm | One language across UI, server, tests, scripts. |
| Framework | **Next.js 15** (App Router, React 19) | SSR/SSG/ISR per route; Server Actions for admin mutations; Route Handlers for webhooks/cron; `output: 'standalone'` for Docker. |
| Database | **PostgreSQL 16** (Neon free tier now; any Postgres later) | ACID for ledger; constraints and partial indexes enforce immutability; `tsvector` search; JSONB for widget layouts and delivery configs. |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | SQL-shaped queries and explicit transactions suit finance code; SQL migrations reviewable by agents; light in serverless. Prisma is the fallback if agents struggle — schema is documented in SQL terms so either works. |
| Auth | **Better Auth** | Built-in email/password with verification, Google OAuth, TOTP two-factor plugin, phone-number OTP plugin (behind flag), session management with revocation (single-session enforced via hook), Drizzle adapter. Auth.js lacks TOTP/OTP plugins; Lucia is deprecated. |
| Authorization | App-level RBAC (`lib/authz`) with permission strings; role rows in DB | Explicit, testable; not tied to auth vendor. |
| UI kit | **Tailwind CSS v4 + shadcn/ui (Radix primitives)** | Accessible primitives, copy-in components that read CSS variables → themes are pure token swaps. |
| Animation | **Motion (framer-motion)** for component/micro-interactions; **GSAP + ScrollTrigger** for scroll chapters; **Lenis** for smooth scroll | GSAP ScrollTrigger is the industry standard for scroll storytelling; Motion covers React-native animation and `useReducedMotion`. |
| 3D | **react-three-fiber + drei** | Declarative Three.js; `dynamic(() => import(), { ssr:false })` + IntersectionObserver lazy load; static poster fallback. |
| Forms / validation | **react-hook-form + Zod** | Shared Zod schemas validate on client and server (Server Actions). |
| Tables | **TanStack Table** | Headless, works with shadcn table. |
| Charts | **Recharts** | Simple, SSR-safe, enough for admin widgets. |
| Dashboard grid | **react-grid-layout** | Mature drag/resize grid; layout JSON persisted per admin. |
| Rich text | **Tiptap** | Headless ProseMirror; JSON stored, rendered server-side to HTML for blogs, instructions, legal pages. |
| PDF | **@react-pdf/renderer** (server) | Invoices, credit notes, partner statements as React components. |
| Email | **Resend + react-email** | Free tier 3k/month; React templates; webhooks for bounces. |
| Object storage | **Cloudflare R2** via `@aws-sdk/client-s3` presigned URLs | S3-compatible → portable; free 10 GB; no egress fees. |
| Captcha | **Cloudflare Turnstile** | Free, invisible, accessible. |
| Analytics | **Umami Cloud** (free) + internal `analytics_events` table | Privacy-friendly, no consent banner (A-1501); internal events feed admin widgets. |
| Error tracking | **Sentry** (free tier) | Client + server + source maps. |
| LLM | **Anthropic Claude via `@anthropic-ai/sdk`** behind `LLMProvider` interface | See §9. |
| FX rates | `open.er-api.com` free daily rates cached in `fx_rates` | Zero cost; admin override possible. |
| QR / UPI | `qrcode` npm generating `upi://pay?pa=<vpa>&pn=CodeKraft&am=<amt>&cu=INR&tn=<orderNo>` | Static UPI intent QR per order; no gateway (D-501). |
| Jobs | **`/api/cron/frequent` (15 min) and `/api/cron/daily`** (secret-protected) triggered by Vercel Cron on Pro, or by a GitHub Actions scheduler workflow on Hobby (which allows only daily crons); system crontab or `node-cron` in container later | Order expiry, subscription reminders/grace, scheduled publish, retention purge, FX refresh, knowledge re-index. |
| Testing | **Vitest** (unit/integration), **Testing Library**, **fast-check** (property tests for finance), **Testcontainers** (Postgres in CI), **Playwright** (e2e), **axe-core**, **Lighthouse CI**, **size-limit** | D-1607 automated CI gates; finance invariants need property tests; CWV and a11y gates need LHCI and axe. |
| Lint/format | ESLint (next/core-web-vitals, jsx-a11y), Prettier | a11y linting supports D-907. |

## 5. Application structure

Single Next.js app. Three route groups map to three audiences; the admin group is served on `admin.<domain>` by middleware host rewrite (A-1201), which also gives it an isolated cookie scope for free.

```
src/
  app/
    (site)/            # public, SSR/SSG: /, /services, /products, /products/[slug], /projects, /projects/[slug], /blog, /blog/[slug], /contact, /legal/*
    (auth)/            # /auth/login, /auth/register, /auth/verify, /auth/reset, /auth/otp (flagged)
    (account)/         # /account/* customer dashboard and /checkout/[offeringId] (client-heavy, auth required)
    (admin)/           # /admin/* → served at admin.<domain>/* (auth + role required)
    api/
      auth/[...all]    # Better Auth handler
      cron/*           # scheduled jobs (secret header)
      webhooks/*       # payment providers (V1.1), Resend
      chat/            # streaming chatbot endpoint
      files/*          # signed upload/download issuance
      notifications/   # GET ?since= poll for in-app inbox (site and admin hosts)
      og/*             # OG image generation
  modules/             # domain modules — the unit of parallel agent work
    auth/  authz/  users/  catalog/  offerings/  media/  content/  blog/
    orders/  payments/  coupons/  quotes/  invoices/  entitlements/  delivery/  subscriptions/
    finance/ (ledger, allocations, payouts, expenses, reports)  approvals/  audit/
    leads/  queries/  chat/  notifications/  dashboard-widgets/  analytics/  settings/  fx/  search/  seo/
  components/
    ui/                # shadcn primitives (token-driven)
    site/  account/  admin/  motion/  three/
  styles/
    tokens.css         # :root + [data-theme] variables
    themes/dark-cinematic.css, light-editorial.css
  lib/                 # db client, env, errors, money, dates, logger, feature-flags
  emails/              # react-email templates
  pdf/                 # invoice, credit note, statement documents
  jobs/                # cron job implementations (called by api/cron)
drizzle/               # schema + migrations
tests/                 # unit, integration, e2e
```

**Module contract.** Each `modules/<name>` exposes `schema.ts` (Drizzle tables), `service.ts` (business logic, transactional), `actions.ts` (Server Actions with Zod input + authz check + audit), `queries.ts` (read models), `types.ts`. Modules import other modules only through their `service.ts`. This is the boundary agents parallelise on (`implementation/`).

## 6. Request flow patterns

- **Public read:** Server Component → `queries.ts` → Postgres. Cached with `unstable_cache`/ISR per route (`revalidate` 60–3600 s) and tag invalidation on publish.
- **Customer/admin mutation:** Client form (react-hook-form + Zod) → Server Action → `authz.assert(permission)` → `service` in a DB transaction (writes domain rows + `audit_logs` + `notifications` + `analytics_events`) → `revalidateTag`.
- **Approval-gated mutation:** Server Action creates `approval_requests` row with a typed payload; approving admin's action runs `approvals.execute()` which dispatches to the module's `apply<Type>()` inside one transaction; requester ≠ approver enforced (BR-13).
- **Cron:** GET `/api/cron/frequent` (15 min) or `/api/cron/daily`, fired by Vercel Cron (Pro) or the GitHub Actions scheduler (Hobby) → verifies `CRON_SECRET` → runs each job in `jobs/`; idempotent; logs to `job_runs`.
- **Chat:** POST `/api/chat` → rate/limit check → retrieval → `LLMProvider.stream()` → SSE to client → persist messages.
- **Files:** upload = server issues presigned PUT (type/size validated) → client uploads to R2 → server records a `media` row and marks the upload intent consumed. Download = server verifies entitlement + cap → issues 5-minute presigned GET → logs `downloads` row.

## 7. Subsystem designs

### 7.1 Payments (provider abstraction — A-402)
```ts
interface PaymentProvider {
  key: 'manual_upi' | 'manual_bank' | 'razorpay' | 'stripe' | 'paypal';
  createIntent(order): Promise<{ instructions: PaymentInstructions }>; // manual: UPI QR / bank details
  confirm(payment, input): Promise<PaymentResult>;                     // manual: admin confirms with reference + received amount
  refund?(payment, amount): Promise<RefundResult>;                     // manual: admin records
  handleWebhook?(req): Promise<void>;                                  // gateways only
}
```
Order lifecycle: `pending_payment → paid → fulfilled` with `failed / cancelled / refunded / partially_refunded` (D-411). `ManualProvider.confirm()` records `amount_received`, computes `bank_shortfall = amount_due − amount_received` (D-516), then `finance.postOrderPaid()` writes ledger entries and allocations in the same transaction.

### 7.2 Finance ledger
Double-entry-lite journal. Every paid order posts, per order item: `sale` (gross), `discount`, `tax_collected`, `gateway_fee` (0 for manual), `bank_charge` (shortfall), `company_cut`, and one `partner_allocation` per partner from the ownership version effective at payment time (BR-05, BR-06). Refunds post proportional negative counterparts for sale, discount, tax, company cut and partner allocations (`refund_*`); gateway fees and bank charges are not reversed. Payouts post `payout` entries against the partner. Expenses post `expense` entries (optionally against a product, shared by the same split unless marked company-only). Balances are computed by summing entries through the `partner_balances` SQL view (plain view; volumes are tiny). Enforced by DB triggers that reject UPDATE/DELETE on journal tables (MASTER_SPEC §4.1).

### 7.3 Entitlements and delivery
`entitlements` row created on `paid`. `delivery_type` ∈ `saas | hosted | download | license | service | custom`. Handlers in `modules/delivery/handlers/<type>.ts` implement `onGranted`, `onRevoked`, `render(customerView)`, `adminActions`. Subscriptions add `subscriptions` row with `current_period_end`, `grace_until`, `status`. Cron drives reminders and grace → `suspended` (D-521). Revocation: handler decides automatic vs admin task (D-607).

### 7.4 Approvals
`approval_requests(type, payload jsonb, requested_by, status, applied_at)` + `approval_decisions`; approvers are derived as every active admin-class user except the requester. Types: `product.publish`, `ownership.change`, `ledger.adjustment`, `refund.issue`, `payout.record`, `product.archive`, `product.delete`, `admin.user_change`, `project_order.split`. All current admins except the requester must approve (BR-13; with two admins this means the other one). Applying is the module's responsibility; the approvals module only orchestrates and audits.

### 7.5 Notifications and "real-time"
`notifications(user_id, type, payload, read_at)` written inside domain transactions. Admin shell polls `GET /api/notifications?since=` every 10 s via TanStack Query with focus-refetch; badge + toast on new rows; inbox lists unread (D-707). Customer dashboard polls every 30 s. Email is sent for customer events (D-1002) and an admin overdue-follow-up daily digest (R-701) through `modules/notifications/channels/{inapp,email,whatsapp(flag)}`.

### 7.6 Widget dashboard
`modules/dashboard-widgets/registry.ts` lists widgets `{key, title, group, defaultSize, minSize, dataLoader, component, requiredPermission}`. Per-admin `dashboard_layouts(user_id, layout jsonb)` persisted from react-grid-layout. Data loaders are Server Actions returning JSON; widgets render client-side with Recharts. Initial library (20): revenue by period, by product, by partner, my share, outstanding payouts, expenses vs profit, payments awaiting confirmation, publish approvals pending, split approvals pending, service checklists due, revocation tasks, new leads, pipeline funnel, overdue follow-ups, conversion rate, open queries, visits & top products, chatbot usage vs limits, plus catalog status counts and new customers.

### 7.7 Content (CMS-lite)
Tables: `landing_chapters`, `services`, `case_studies`, `testimonials`, `client_logos`, `faqs`, `legal_pages`, `product_blogs`, `site_settings`. Rich text stored as Tiptap JSON, rendered to HTML on the server (`@tiptap/html`) with an allow-list sanitizer. Publishing triggers `revalidateTag('content')`.

### 7.8 Search, currency, FX
Products: generated `search_vector tsvector` column (name, descriptions, tags, tech, industry) with GIN index; filters via SQL (D-310, A-304). Prices: `offering_prices(offering_id, currency, amount_minor)`; display currency from user setting or cookie; if no explicit price for a currency, convert from base using `fx_rates` (D-502). Checkout always charges base currency in release 1.

### 7.9 Feature flags
`lib/feature-flags.ts` reads `site_settings` (DB) with env overrides: `phone_otp`, `whatsapp_channel`, `theme_light_editorial`, `provider_razorpay`, `provider_stripe`, `provider_paypal`, `automated_provisioning`, `three_hero`, `bundles`, `vendor_marketplace`.

## 8. Admin subdomain mechanics
`middleware.ts`: if `host` equals the `ADMIN_HOST` env value (e.g. `admin.codekraft.example`, or a second `*.vercel.app` project hostname during the interim, since nested subdomains are not available on `*.vercel.app`) → rewrite `/x` to `/admin/x`; on any other host, `/admin/*` returns 404. Better Auth cookies default to host-only, so admin and site sessions are separate. Admin role check happens in the `(admin)/layout.tsx` server component and again in every Server Action (defence in depth, `docs/09`).

## 9. AI / chatbot architecture (spec §12)

**Required capabilities:** answer questions about products, services, FAQs and policies from site content only; quick-reply menus for order status, downloads, contact; capture lead intent; escalate to a query; respect per-user and platform daily caps; store transcripts 12 months; expose prompts and usage to admins.

**Knowledge source:** `knowledge_chunks(source_type, source_id, title, body, search_vector)` rebuilt by cron and on content publish from products, offerings, services, FAQs, legal pages, case studies. Retrieval = Postgres full-text `ts_rank` top-8 chunks (corpus is tiny; embeddings unnecessary — A-304). Menu intents resolve via `modules/chat/menus.ts` without the LLM. Tool use is limited to one side-effect-free `capture_lead` intent tool: the model may signal that the user expressed project intent; a lead is created only after the user explicitly confirms in the UI (docs/06 API-CHAT-15).

**Provider:** `LLMProvider` interface (`stream(system, messages, opts)`), implemented by `AnthropicProvider` using the official `@anthropic-ai/sdk` (streaming, adaptive thinking omitted/low effort for chat latency). Default model `claude-opus-5` (USD 5 / 25 per million input/output tokens); `claude-haiku-4-5` (USD 1 / 5) is the configurable cost alternative. At the founder's volume both cost well under a dollar per month; the model ID lives in `site_settings.ai_model` so admins can switch. Refusal handling: on `stop_reason: "refusal"` the bot falls back to a menu answer. Prompt text and version stored in `prompt_versions`; admins can view, edit and roll back (spec §12 prompt management).

**Controls:** `chat_usage_daily(user_id | 'platform', date, count)` checked before each call (D-708); when exceeded the bot answers from menus only and notifies admins once per day. Timeouts 20 s; max output 600 tokens; system prompt forbids answering outside provided context.

**Privacy:** transcripts linked to `user_id`, purged by cron after 12 months (D-1503); no PII sent beyond the user's own message text; provider retention noted in privacy policy.

## 10. External integrations

| Service | Used for | Failure behaviour |
|---------|----------|-------------------|
| Neon Postgres | All data | App unavailable (single dependency) |
| Cloudflare R2 | Media, downloads, PDFs | Uploads/downloads fail gracefully with retry message; catalog still renders |
| Resend | Email | Queue row `email_outbox` retried by cron; in-app notification still delivered |
| Anthropic API | Chat answers | Menu-only fallback |
| open.er-api.com | FX | Last cached rate used; admin warned if > 3 days old |
| Umami | Traffic analytics | Silent |
| Turnstile | Form protection | Fail-closed on public forms, with error message |
| Sentry | Errors | Silent |
| Vercel Cron | Jobs | `job_runs` table shows missed runs on the admin system widget |

## 11. Portability (D-1401)
`next.config.ts` → `output: 'standalone'`; `Dockerfile` (multi-stage, Node 22 alpine); `docker-compose.yml` for local Postgres; cron via `jobs/scheduler.ts` (node-cron) when `RUN_SCHEDULER=true`. No Vercel-only APIs in `modules/`; `@vercel/og` replaced by `next/og` (framework-native). Image optimisation via `next/image` with R2 as remote pattern; on a VPS the built-in optimizer runs in-process.

## 12. Architecture decision records (summary)

| ADR | Decision | Alternatives rejected |
|-----|----------|-----------------------|
| ADR-01 | Next.js full-stack monolith | SPA+API, Astro+Next, Remix, Django, BaaS |
| ADR-02 | Postgres + Drizzle | MongoDB, Prisma (acceptable fallback) |
| ADR-03 | Better Auth | Auth.js, Clerk (cost, lock-in), custom |
| ADR-04 | Manual payment provider first behind interface | Wait for gateway; hardcode UPI flow |
| ADR-05 | Append-only journal with DB triggers | Mutable balances table |
| ADR-06 | Polling for admin real-time | WebSockets/Pusher (cost, serverless friction), SSE (fine later) |
| ADR-07 | Postgres full-text for search and chat retrieval | Meilisearch/Algolia, vector DB |
| ADR-08 | Anthropic Claude behind LLMProvider | OpenAI, Gemini, local models (all pluggable later) |
| ADR-09 | Single app with host-rewritten admin subdomain | Separate admin app in monorepo |
| ADR-10 | Tiptap JSON + server render for all rich text | Markdown, external headless CMS |
| ADR-11 | Design tokens via CSS variables + `data-theme` | Separate stylesheets per theme, CSS-in-JS themes |
| ADR-12 | Single-offering checkout, multi-item order schema | Full cart |

## 13. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Neon free-tier cold starts hurt LCP | ISR for public pages; DB not on the critical path of first paint |
| GSAP scroll-jacking vs CWV/INP | Chapters use `ScrollTrigger` with `scrub` on transforms/opacity only; no layout thrash; measured in CI with Lighthouse |
| Better Auth plugin maturity for phone OTP | Behind flag; not on release-1 critical path |
| Ledger correctness | Property-based tests on allocation sums; DB triggers; invariants in `docs/10` |
| Two admins, one offline, approvals stall | Approval requests have no expiry; system widget shows pending age; admins are the only approvers (BR-13 accepted) |
