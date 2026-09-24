# 06 — API SPECIFICATION

**Implements:** `docs/04-SOLUTION-ARCHITECTURE.md` §5–§9, `docs/05-DATABASE-DESIGN.md` (all `T-` tables), `MASTER_SPEC.md` §4 rules, baseline §2–§13.
**Feeds:** `07-UX-UI-SPECIFICATION`, `09-SECURITY-DESIGN`, `10-QA-TEST-STRATEGY`, `implementation/`.
**ID scheme:** `API-<AREA>-nn`; areas per `MASTER_SPEC.md` §6 (AUTH, CAT, COM, PAY, DEL, FIN, LEAD, CHAT, CONT, ADM, DASH, NOTIF, SEO, OPS). SEC/PERF/A11Y have no endpoints of their own; their rules appear in §1.

CodeKraft exposes two surfaces from one Next.js 15 app (ADR-01):

| Surface | Used for | Lives in | Transport |
|---------|----------|----------|-----------|
| **Server Actions** | Every mutation and every authenticated read model that a client component fetches (widget loaders, notification polls) | `modules/<name>/actions.ts` (mutations), `modules/<name>/queries.ts` (server reads consumed by Server Components) | Next.js action RPC (POST, same origin only) |
| **Route Handlers** | Auth, cron, webhooks, chat streaming, presigned files, OG images, health | `app/api/**/route.ts` | HTTP |

Public Server Components call `queries.ts` directly (architecture §6 "Public read"); those reads are catalogued here as `queries` because their filters, sorts and cache tags are contracts the UI depends on.

---

## 1. Conventions

### 1.1 Auth context
- Session comes from Better Auth (`auth.api.getSession()` on the request cookie). Every action starts with `const ctx = await requireContext(opts)` which returns `{ user, roles, permissions, partnerId?, ip, userAgent, requestId, host }` or throws `UNAUTHENTICATED`.
- Admin host: actions invoked from `admin.<domain>` require an admin-class role **and** the request host to be the admin host (architecture §8, A-1201); the same action called from the site host with an admin session is refused with `FORBIDDEN`.
- Single active session (D-1203): a session that has been replaced returns `SESSION_REPLACED`; idle timeouts 30 min admin / 60 min customer are enforced by Better Auth session `updateAge`/`expiresIn` per host.
- Customer purchase actions additionally require `email_verified = true` (D-1201) → `EMAIL_UNVERIFIED`; suspended users get `ACCOUNT_SUSPENDED` on every non-auth action.

### 1.2 Permission strings (`T-permissions`) and role matrix (`T-role_permissions`)
Roles are rows in `T-roles`: `super_admin`, `admin`, `staff`, `customer` (A-201, D-201). `authz.assert(ctx, permission, scope?)` checks the permission and, for the `admin` role, applies the data scope in the last column (D-512). Legend: **●** granted, **◐** granted with scope, **—** not granted.

| Group | Permission | super_admin | admin | staff | customer | Admin scope (D-512) |
|-------|-----------|:-:|:-:|:-:|:-:|---|
| Self | `account.self` (profile, settings, delete, sessions) | ● | ● | ● | ● | own row |
| Self | `commerce.self` (checkout, orders, payments, invoices, wishlist, quotes) | — | — | — | ● | own rows |
| Self | `delivery.self` (entitlements, downloads, keys, subscriptions) | — | — | — | ● | own rows |
| Self | `support.self` (queries), `chat.use` | — | — | — | ● | own rows |
| Catalog | `catalog.read` | ● | ● | ● | — | all (BR-02 hides ownership only from buyers) |
| Catalog | `catalog.write` (product/offering/media/version/faq/testimonial/blog CRUD) | ● | ◐ | ● | — | products where caller is a partner on the active or pending ownership |
| Catalog | `catalog.submit` (submit for approval, schedule, unpublish) | ● | ◐ | — | — | own products |
| Catalog | `catalog.lifecycle.request` (archive/delete → approval) | ● | ◐ | — | — | own products |
| Catalog | `ownership.propose` | ● | ◐ | — | — | own products |
| Content | `content.read`, `content.write` | ● | ● | ● | — | — |
| Content | `content.publish` | ● | ● | — | — | — |
| Commerce | `orders.read` | ● | ◐ | ● | — | orders containing own products |
| Commerce | `orders.manual.write` (manual/project orders, custom quotes, coupons) | ● | ● | — | — | — |
| Payments | `payments.confirm` (confirm / fail) | ● | ● | — | — | — |
| Payments | `refunds.propose` | ● | ● | — | — | — |
| Invoices | `invoices.issue`, `invoices.read` | ● | ◐ | ● | — | own-product orders |
| Delivery | `delivery.tasks.write` (provision, revoke tasks, license keys, service steps) | ● | ◐ | ● | — | own products |
| Delivery | `entitlements.admin` (grant, revoke, reset download count) | ● | ◐ | — | — | own products |
| Finance | `finance.ledger.read` | ● | ◐ | — | — | own partner lines + entries on own products |
| Finance | `finance.ledger.read_all` | ● | — | — | — | — |
| Finance | `finance.payout.record` (→ approval) | ● | ● | — | — | any partner |
| Finance | `finance.expense.write` | ● | ● | — | — | — |
| Finance | `finance.adjustment.propose` (→ approval) | ● | ● | — | — | — |
| Finance | `finance.reports.read`, `finance.statements.export` | ● | ◐ | — | — | own statement only |
| Approvals | `approvals.read` | ● | ● | — | — | — |
| Approvals | `approvals.decide` | ● | ● | — | — | never own requests (BR-13) |
| Audit | `audit.read`, `audit.export` | ● | ● | — | — | — |
| Leads | `leads.read` | ● | ◐ | ● | — | assigned to caller or unassigned pool |
| Leads | `leads.read_all` | ● | — | — | — | — |
| Leads | `leads.write` (status, notes, follow-up), `leads.assign` | ● | ◐ | ● | — | assigned or claiming from pool |
| Queries | `queries.read`, `queries.reply`, `queries.close` | ● | ● | ● | — | — |
| Chat | `chat.transcripts.read`, `chat.prompts.write` | ● | ● | — | — | — |
| Customers | `customers.read`, `customers.notes.write` | ● | ● | ● | — | — |
| Customers | `customers.suspend`, `customers.reset_link` | ● | ● | — | — | — |
| Settings | `settings.read` | ● | ● | ● | — | — |
| Settings | `settings.write` (incl. feature flags, AI limits, payment methods) | ● | — | — | — | — |
| Users | `users.admin.manage` (invite/remove/role change → approval) | ● | — | — | — | — |
| Dashboard | `dashboard.admin` (layouts + widget loaders; each widget also declares its own `requiredPermission`) | ● | ● | ● | — | — |
| Media | `media.upload` | ● | ● | ● | — | — |
| Analytics | `analytics.read` | ● | ● | — | — | — |

Rules: a Super Admin is also a partner (seed §14) so `◐` scopes never apply to them. `staff` is defined but not seeded (D-201). `customer` is the only role with `*.self` permissions; an admin who buys a product must use a separate customer account (BR-04 one login per customer account; admin sessions are host-scoped).

### 1.3 Input validation
Every action's first line is `const input = schema.parse(raw)` with a Zod schema exported from `modules/<name>/types.ts` and reused by react-hook-form on the client. Unknown keys are stripped. Strings are trimmed; `slug` = `^[a-z0-9]+(?:-[a-z0-9]+)*$` max 80; `Money` = `{ amountMinor: z.number().int().nonnegative(), currency: z.enum(['INR','USD','EUR','GBP','CAD']) }` (D-518, MASTER_SPEC §4.8); `bps` = int 0–10000; rich text = Tiptap JSON validated against an allow-list schema (ADR-10); `uuid` for all IDs.

### 1.4 Result envelope
```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]>; retryAfterMs?: number } };
```
Actions never throw to the client (a thrown error becomes `INTERNAL` with a Sentry event id in `message`). Route Handlers return the same `error` object as JSON with the HTTP status in the table below.

| Code | HTTP | When |
|------|------|------|
| `UNAUTHENTICATED` | 401 | No/expired session |
| `SESSION_REPLACED` | 401 | Session ended by a newer login (D-1203) |
| `EMAIL_UNVERIFIED` | 403 | Purchase/chat before verification (D-1201) |
| `ACCOUNT_SUSPENDED` | 403 | `users.status = suspended` |
| `FORBIDDEN` | 403 | Missing permission, out of scope, wrong host, requester-as-approver |
| `VALIDATION` | 400 | Zod failure; `fieldErrors` populated |
| `CAPTCHA_FAILED` | 400 | Turnstile token invalid/expired (D-1204) |
| `NOT_FOUND` | 404 | Row missing or not visible to caller |
| `STATE_INVALID` | 409 | Lifecycle transition not allowed (e.g. confirm a `failed` payment) |
| `CONFLICT` | 409 | Uniqueness/version conflict (slug taken, stale `updatedAt`) |
| `DUPLICATE_PURCHASE` | 409 | One-time offering already owned (BR-10) |
| `ORDER_EXPIRED` | 410 | Pending order older than 7 days (BR-10) |
| `LIMIT_EXCEEDED` | 429 | Download cap, chat daily cap, coupon redemptions |
| `RATE_LIMITED` | 429 | Sliding-window limit hit; `retryAfterMs` set |
| `IDEMPOTENT_REPLAY` | 200 | Same idempotency key seen; original `data` returned (informational, `ok: true`) |
| `UPSTREAM_UNAVAILABLE` | 503 | R2, Resend, Anthropic, FX API failure that could not be degraded |
| `INTERNAL` | 500 | Unexpected |

### 1.5 Idempotency
| Action class | Key | Behaviour |
|--------------|-----|-----------|
| `payments.confirm` / `payments.fail` | `paymentId` + target status | Re-confirm with the same `amountReceived` and `reference` → `IDEMPOTENT_REPLAY`; with different values → `STATE_INVALID` (confirmed payments are immutable, `T-payments` trigger). |
| Refund execute, payout record, ledger adjustment, ownership change, publish, project-order split | `approvalRequestId` | Application happens once inside `approvals.execute()`; `applied_at` set in the same transaction; a second approve returns `IDEMPOTENT_REPLAY`. |
| Checkout `createOrder` | `(userId, offeringId)` while an order is `pending_payment` | Returns the existing pending order instead of creating a second one. |
| Cron jobs | `(job, window)` | Each job checks `job_runs` for an `ok` run in the current window before acting; all writes use "where status = X" guards. |
| Gateway webhooks (V1.1) and Resend | `provider + event_id` | Stored in `webhook_events` (`UNIQUE(provider, event_id)`, docs/05 §11); a duplicate insert is a 200 no-op. |

### 1.6 Audit rule (MASTER_SPEC §4.9, D-1104)
Every action reached from an admin session writes one `T-audit_logs` row **in the same transaction** as its domain writes: `action` = the API ID plus dotted verb (e.g. `API-CAT-03 product.update`), `before`/`after` JSON diffs, `ip`, `user_agent`, `request_id`. Read-only Server Actions (widget data loaders, list queries, notification polls) are exempt (MASTER_SPEC §4.9). Customer actions audit only security-relevant events (login, password/email change, delete account, download issuance, payment reference submission). Auth events are written by Better Auth hooks (`auth.sign_in`, `auth.sign_out`, `auth.2fa_enabled`, `auth.password_reset`).

### 1.7 Rate limits (D-1204)
Sliding windows in Postgres (`rate_limit_buckets`, in-memory on a single container) keyed by IP and by user id; the stricter of the two applies. Values are the canonical set from `docs/03` NFR-SEC-03 (proposed starting values, tunable in `site_settings`; docs/09 §7 mirrors them).

| Class | Limit | Applies to |
|-------|-------|------------|
| `login` | 10 / 15 min per IP; 5 / 15 min per account (lock 15 min) | password sign-in |
| `totp` | 5 / 5 min per session attempt | TOTP verification |
| `signup` | 5 / h per IP | email sign-up |
| `verify_resend` | 3 / h per email | verification resend |
| `reset` | 3 / h per email; 10 / h per IP | password-reset request |
| `otp` (flagged) | 5 / h per phone; 10 / h per IP | phone OTP send |
| `public_form` | 5 / h per IP (+ Turnstile) | inquiry, contact, product CTA, visitor query |
| `chat` | 30 messages / 10 min per user; daily caps from `site_settings` (D-708) | `/api/chat` |
| `download` | 20 / h per user; cap per entitlement (BR-15) | download issuance |
| `key_reveal` | 10 / h per user | `revealLicenseKey` |
| `checkout` | 10 / day per user | `createOrder`, `submitPaymentReference` |
| `coupon` | 10 / 10 min per user | coupon validation |
| `quote_lookup` | 10 / h per IP | `/quote/[token]` lookup |
| `upload` | 30 / h per user | upload intents |
| `poll` | 30 / min per session | notification polls |
| `admin` | 300 / min per user | all admin actions |
| `analytics` | 120 / min per anon/user | event ingest |
| `cron` | 1 concurrent per job | `/api/cron/*` |

### 1.8 Pagination, filtering, sorting
List queries accept `{ cursor?: string; limit?: number (1–100, default 25); sort?: '<field>:asc'|'<field>:desc'; filters?: Record<string, unknown>; q?: string }` and return `{ items: T[]; nextCursor: string | null; total?: number }`. Cursor = base64 of `(sortValue, id)`; `total` is returned only when `limit ≤ 100` and the filtered set is `< 10 000` rows. Every list documents its allowed `sort` fields and `filters` keys; unknown keys → `VALIDATION`. Admin tables (TanStack) use the same shape.

### 1.9 Money, time, identifiers
- Money everywhere as `{ amountMinor: number; currency: 'INR'|'USD'|'EUR'|'GBP'|'CAD' }`; INR equivalents are `amountInrMinor` with `fxRateToInr` (D-515). No floats cross the boundary.
- Timestamps: ISO-8601 UTC strings (`2026-09-24T10:15:00.000Z`); dates (payout `paidOn`, expense `incurredOn`) as `YYYY-MM-DD`.
- Public identifiers: `orderNo` (`CK-ORD-000001`), `invoiceNo` (`CK/2026-27/0001`, BR-16), `creditNo` (`CK/CN/2026-27/0001`). Internal ids are UUIDs and never appear in public URLs; public URLs use slugs.

### 1.10 Cache tags
`revalidateTag` keys used by actions: `catalog` (lists), `product:<slug>`, `blog`, `blog:<slug>`, `content` (landing, services, legal, testimonials, logos, faqs), `case-studies`, `case-study:<slug>`, `settings`, `sitemap`. Public reads use `revalidate` 300 s (catalog/product), 3600 s (content/legal), 60 s (blog index).

---

## 2. Server Actions and query catalogue

Column key: **Caller** = role or permission; **Approval** = `T-approval_requests.type` created instead of applying directly; **Side effects** list tables written (beyond `audit_logs`, which every admin action writes), notifications (`N:` type), emails (`E:` template), cache tags (`T:`), analytics events (`A:`).

### 2.1 AUTH — auth, profile, settings (`modules/auth`, `modules/users`, `modules/settings`)

| ID | Action / query | Caller | Input | Output | Side effects | Approval | Failures |
|----|----------------|--------|-------|--------|--------------|----------|----------|
| API-AUTH-01 | Better Auth flows via `/api/auth/[...all]` (§3.1) | Visitor | per flow | per flow | `sessions`, `accounts`, `verifications`, `two_factor`; audit `auth.*`; `A: signup`, `login` with method (D-1302) | — | `RATE_LIMITED`, `VALIDATION` |
| API-AUTH-02 | `getMe()` | any session | — | `{ user, roles, permissions, displayCurrency, themePref, emailVerified, twoFactorEnabled, partner? }` | — | — | `UNAUTHENTICATED` |
| API-AUTH-03 | `updateProfile` | `account.self` | `{ name: string(1..120), image?: mediaId, billing?: { billingName, company?, address?: {line1,line2?,city,state?,postalCode,country}, country: char2, gstNumber?: /^[0-9A-Z]{15}$/ } }` | `{ user, profile }` | `users`, `customer_profiles` | — | `VALIDATION` |
| API-AUTH-04 | `updateSettings` | `account.self` | `{ displayCurrency?: Currency; themePref?: 'dark-cinematic'\|'light-editorial'\|null }` | `{ settings }` | `users.display_currency/theme_pref`; refreshes the `ck_currency`, `ck_theme` cookies so ISR pages and the ≤ 300-byte head script pick them up before paint (D-905, D-502, MASTER_SPEC §7 "Theme attribute on ISR pages", "Visitor currency selector"); on login the account values are loaded into the same cookies | — | `VALIDATION`, `FORBIDDEN` if `light-editorial` while flag `theme_light_editorial` off (D-1602) |
| API-AUTH-05 | `changeEmailRequest` / `changePassword` | `account.self` | Better Auth `changeEmail` / `changePassword` wrappers; require current password | `{ ok }` | `verifications`; `E: email-change-verify`; audit | — | `VALIDATION`, `RATE_LIMITED` |
| API-AUTH-06 | `listSessions` / `revokeSession` | `account.self` | `{ sessionId }` | `{ sessions[] }` | `sessions`; audit | — | `NOT_FOUND` |
| API-AUTH-07 | `enableTotp` / `verifyTotp` / `disableTotp` | admin-class roles only (D-1202; X-003 for customers) | Better Auth two-factor plugin wrappers | `{ totpUri, backupCodes }` / `{ ok }` | `two_factor`; audit `auth.2fa_*` | — | `FORBIDDEN` for customers |
| API-AUTH-08 | `deleteAccount` | `customer` with `account.self` | `{ password?: string; confirmPhrase: 'DELETE' }` (password required for credential accounts) | `{ anonymizedAt }` | In one transaction: `users.status='deleted', deleted_at, anonymized_at`, PII columns overwritten (email → `deleted-<uuid>@anon.invalid`, name, phone, image), `customer_profiles` cleared, `accounts`/`two_factor` deleted, all `sessions` revoked, `wishlists` cleared, active `subscriptions` cancelled, chat transcripts purged; orders/invoices/ledger/audit rows kept 7 years; `E: account-deleted` (sent to the pre-anonymisation address) (BR-18, D-1003, MASTER_SPEC §7 "Anonymisation timing" — no grace window) | — | `STATE_INVALID` if `entitlements.status='active'` with `delivery_type='service'` in progress (admin must close first) |
| API-AUTH-09 | `getPublicSettings()` (query) | Visitor | — | `{ baseCurrency, enabledCurrencies, defaultTheme, flags: { phoneOtp, themeLightEditorial, threeHero, bundles }, turnstileSiteKey }` | cached `T: settings` | — | — |
| API-AUTH-10 | `setVisitorPreferences` | Visitor (no session) | `{ displayCurrency?: Currency; theme?: 'dark-cinematic'\|'light-editorial' }` | `{ ok }` | sets `ck_currency` / `ck_theme` cookies only (1 year, not HttpOnly); `light-editorial` accepted only while `theme_light_editorial` is on (MASTER_SPEC §7 "Visitor currency selector", "Theme toggle at launch") | — | `VALIDATION` |

### 2.2 CAT — catalog admin, ownership, public catalog, wishlist (`modules/catalog`, `offerings`, `media`, `blog`, `search`)

**Admin catalog mutations** (all require admin host; `catalog.write` scoped per §1.2).

| ID | Action | Caller | Input | Output | Side effects | Approval | Failures |
|----|--------|--------|-------|--------|--------------|----------|----------|
| API-CAT-01 | `createProduct` | `catalog.write` | `{ name, slug, shortDescription, categoryId?, tags?: string[] }` | `{ productId, status: 'draft' }` | `products` (status `draft`), `product_tags`; initial `product_ownerships` v1 `pending` with 100% to creating partner if caller is a partner, else empty (must be set before submit) | — | `CONFLICT` slug |
| API-CAT-02 | `updateProduct` | `catalog.write` | `{ productId, expectedUpdatedAt, patch: Partial<{ name, slug, shortDescription, descriptionJson, categoryId, tags, isFeatured, isUnlisted, isComingSoon, isRefundable, taxEnabled, currentVersion, features, benefits, targetAudience, useCases, industry[], techStack[], requirementsJson, liveDemoUrl, seoTitle, seoDescription, ogImageMediaId, canonicalUrl }> }` | `{ product }` | `products`; if `published`: `T: catalog, product:<slug>, sitemap`; `knowledge_chunks` re-index for that product (architecture §9); a `slug` change on a published product inserts `slug_redirects(entity='product', old_slug, new_slug)` so the old URL 301s (MASTER_SPEC §7 "Slug changes") | — | `CONFLICT` (stale `expectedUpdatedAt`), `STATE_INVALID` (archived) |
| API-CAT-03 | `upsertOffering` / `deleteOffering` | `catalog.write` | `{ productId, offeringId?, name, slug, position, isDefault, purchaseModel: 'one_time'\|'subscription'\|'custom_quote', billingInterval?: 'monthly'\|'quarterly'\|'annual', trialDays?, licenseType?, deliveryType: 'saas'\|'hosted'\|'download'\|'license'\|'service'\|'custom', deliveryConfig: { provisioning: 'manual'\|'automated', downloadCap?: int, accessMonths?: int\|null, updatePolicy: 'all_free'\|'during_access'\|'major_paid', instructionsJson? }, serviceSteps?: [{key,title,description}], instructionsJson?, status: 'active'\|'inactive' }` | `{ offering }` | `offerings`; delete allowed only with zero `order_items` else sets `inactive` (BR-11 analogue) | — | `VALIDATION` (`subscription` requires `billingInterval`; `service` requires ≥1 step; `automated` requires flag `automated_provisioning`), `CONFLICT` |
| API-CAT-04 | `setOfferingPrices` | `catalog.write` | `{ offeringId, prices: [{ currency, amountMinor, compareAtMinor? }] }` | `{ prices[] }` | `offering_prices` (replace set; base-currency row mandatory, D-502) | — | `VALIDATION` base row missing, `compareAtMinor ≤ amountMinor` |
| API-CAT-05 | `setOfferingPaymentMethods` | `catalog.write` | `{ offeringId, methods: ('manual_upi'\|'manual_bank'\|'razorpay'\|'stripe'\|'paypal')[] }` | `{ methods }` | `offering_payment_methods` (D-110) | — | `VALIDATION` gateway method whose flag is off or not enabled in settings |
| API-CAT-06 | `attachProductMedia` / `reorderProductMedia` / `detachProductMedia` | `catalog.write` | `{ productId, kind, mediaId?\|embedUrl?, title?, alt (required, 1..125 chars, for `image`/`screenshot`/`gallery`/`og`), position }` | `{ productMedia[] }` | `product_media` (incl. `alt`); `media.visibility` must be `public` for image kinds, `private` for `attachment` (A-1202) | — | `VALIDATION` (missing `alt` on image kinds; embed hosts allow-list youtube/vimeo; `presentation` must be `application/pdf`) |
| API-CAT-07 | `createProductVersion` | `catalog.write` | `{ productId, version: semver, changelogJson, releaseFile?: { mediaId, notes } }` | `{ version }` | `product_versions`, `release_files` (D-313, D-604); `products.current_version`; `N: product.updated` to active entitlement holders whose `update_policy` grants it; `E: product-update` | — | `CONFLICT` version exists |
| API-CAT-08 | `upsertProductFaq` / `deleteProductFaq` / `reorder` | `catalog.write` | `{ productId, faqId?, question, answerJson, position }` | `{ faqs[] }` | `product_faqs`; `knowledge_chunks` | — | — |
| API-CAT-09 | `upsertProductTestimonial` / `delete` | `catalog.write` | `{ productId, id?, authorName, authorTitle?, company?, quote, avatarMediaId?, position, published }` | `{ testimonials[] }` | `product_testimonials` (D-312) | — | — |
| API-CAT-10 | `upsertProductBlog` / `publishProductBlog` / `unpublishProductBlog` | `catalog.write` (publish: `content.publish`) | `{ productId, slug, title, excerpt, bodyJson, coverMediaId?, seoTitle?, seoDescription? }` | `{ blog }` | `product_blogs` (one per product, D-121); publish sets `published_at`; a `slug` change on a published blog inserts `slug_redirects(entity='blog')`; `T: blog, blog:<slug>, product:<slug>, sitemap`; `knowledge_chunks` | — (blog publish is not a BR-13 action; product must be `published`) | `STATE_INVALID` product not published, `CONFLICT` slug |
| API-CAT-11 | `submitForApproval` | `catalog.submit` | `{ productId, publishAt?: ISO }` | `{ approvalRequestId }` | `products.status='pending_approval'`, `publish_at`; `approval_requests(type='product.publish', payload:{productId, publishAt})`; `N: approval.requested` to all other admins | `product.publish` (BR-12, D-1102) | `STATE_INVALID` unless `draft`/`unpublished`; `VALIDATION` readiness: ≥1 active offering with base price and ≥1 payment method, ≥1 image, active or pending ownership summing 10000 bps |
| API-CAT-12 | `applyPublish` (internal, called by `approvals.execute`) | system | approval payload | — | `products.status='published'` (or `scheduled` if `publishAt` future; cron `publish.scheduled` flips it), `published_at`; ownership `pending` → `active` if approved in the same request; `T: catalog, product:<slug>, sitemap`; `knowledge_chunks`; `N: product.published` to requester | — | — |
| API-CAT-13 | `unpublishProduct` | `catalog.submit` | `{ productId, reason }` | `{ product }` | `status='unpublished'`; `T: catalog, product:<slug>, sitemap`; existing entitlements unaffected | — | `STATE_INVALID` |
| API-CAT-14 | `requestArchive` / `requestDelete` | `catalog.lifecycle.request` | `{ productId, reason }` | `{ approvalRequestId }` | `approval_requests(type='product.archive'\|'product.delete')`; delete refused up front if any `order_items.product_id` exists (BR-11) | `product.archive` / `product.delete` (BR-13) | `STATE_INVALID` (delete with orders → caller told to archive) |
| API-CAT-15 | `applyArchive` / `applyDelete` (internal) | system | approval payload | — | archive: `status='archived', archived_at`, offerings `inactive`, `T:` tags; delete: hard delete product graph + `media` objects on R2 (private ones), only when zero orders re-checked in the transaction | — | — |
| API-CAT-16 | `proposeOwnership` | `ownership.propose` | `{ productId, companyCutBps, lines: [{ partnerId, shareBps }], effectiveFrom?: ISO }` | `{ ownershipId, approvalRequestId }` | `product_ownerships(version=n+1, status='pending')`, `product_ownership_lines` (sum 10000 enforced by trigger); `approval_requests(type='ownership.change', payload:{ownershipId})`; `N: approval.requested` to all other admins | `ownership.change` (BR-05, D-506, D-509) | `VALIDATION` sum ≠ 10000, unknown/inactive partner; `STATE_INVALID` another `pending` version exists |
| API-CAT-17 | `applyOwnershipChange` (internal) | system | approval payload | — | previous `active` → `superseded`; new → `active`, `effective_from = max(now, requested effectiveFrom)`; **no** existing `allocations` touched (BR-05) | — | — |
| API-CAT-18 | `listProductsAdmin` (query) | `catalog.read` | list params; filters `status, categoryId, partnerId, search` ; sort `updatedAt, name, status` | `{ items: ProductAdminRow[] }` including ownership summary | — | — | — |
| API-CAT-19 | `getProductAdmin` (query) | `catalog.read` | `{ productId }` | full graph: product, offerings+prices+methods, media, versions, faqs, testimonials, blog, ownership versions, approval state, order count | — | — | `NOT_FOUND` |
| API-CAT-20 | `upsertCategory` / `deleteCategory` / `upsertTag` | `catalog.write` (unscoped) | `{ id?, parentId?, name, slug, position, description? }` | `{ category }` | `categories` (depth ≤ 2 trigger, D-303), `tags` | — | `VALIDATION` depth, `CONFLICT` slug, `STATE_INVALID` delete with products |
| API-CAT-21 | `createUploadIntent` | `media.upload` | see §3.5 | presigned PUT | `files_upload_intents`, `media` on `completeUpload` | — | — |

**Public catalog reads** (`queries.ts`, cached; visibility rules: `status='published'` and not `is_unlisted` for lists; unlisted products render by direct slug, D-314).

| ID | Query | Caller | Input | Output | Notes |
|----|-------|--------|-------|--------|-------|
| API-CAT-30 | `listProducts` | Visitor | `{ q?, filters?: { categorySlug?, priceMin?, priceMax? (in display currency), purchaseModel?, deliveryType?, techStack?: string[], industry?: string[], targetAudience?: string[] }, sort?: 'newest'\|'price_asc'\|'price_desc'\|'popular'\|'featured', cursor?, limit? }` (D-310, A-303) | `{ items: ProductCard[] ({ slug, name, shortDescription, coverImage, category, tags, fromPrice: Money (display currency), compareAtPrice?, purchaseModels[], deliveryTypes[], isFeatured, isComingSoon, currentVersion }), nextCursor }` | `q` uses `products.search_vector` (`websearch_to_tsquery`, A-304); `popular` = `analytics_events` product views 30 d + orders; price filter applies to the default offering's price converted via `fx_rates` (D-502) |
| API-CAT-31 | `getProductBySlug` | Visitor | `{ slug, displayCurrency }` | `ProductDetail` = product content, media (signed URLs for `presentation`, public URLs otherwise), offerings with prices in display currency + base, enabled methods, FAQs, testimonials, versions+changelog, blog teaser, JSON-LD `Product`, breadcrumbs; **never** ownership (BR-02) | `NOT_FOUND` for `draft/pending/scheduled/archived`; `unpublished` → `NOT_FOUND` unless the caller holds an entitlement for it |
| API-CAT-32 | `listCategories`, `listFilterFacets` | Visitor | — | tree + facet value counts | cached `T: catalog` |
| API-CAT-33 | `listBlogPosts` / `getBlogBySlug` | Visitor | list params; `{ slug }` | `{ items: BlogCard[] }` / `{ blog, product: ProductCard, html }` with JSON-LD `Article` (D-804) | only `published` |
| API-CAT-34 | `listFeaturedProducts` / `listBlogTeasers` (landing) | Visitor | `{ limit }` | cards | from `featured_products` order (D-314) |
| API-CAT-35 | `toggleWishlist` | `commerce.self` | `{ productId, on: boolean }` | `{ wishlisted: boolean }` | `wishlists`; `A: wishlist_add` (D-1302) | — | `NOT_FOUND` non-published product |
| API-CAT-36 | `listMyWishlist` (query) | `commerce.self` | list params | `{ items: ProductCard[] }` | — | — |

### 2.3 COM — checkout, orders, coupons, quotes, manual orders, invoices (`modules/orders`, `coupons`, `quotes`, `invoices`)

| ID | Action | Caller | Input | Output | Side effects | Approval | Failures |
|----|--------|--------|-------|--------|--------------|----------|----------|
| API-COM-01 | `previewCheckout` (query) | `commerce.self` | `{ offeringId, couponCode? }` | `{ offering, product, lines: [{ description, unitMinor, discountMinor, taxMinor, totalMinor }], subtotal, discount, tax, total (all base currency), displayTotal: Money, taxRateBps, coupon?: { code, kind, value }, enabledMethods[], warnings[] }` | none | — | `DUPLICATE_PURCHASE`, `STATE_INVALID` (coming soon, inactive, `custom_quote` model), `VALIDATION` coupon invalid/expired/exhausted/not first purchase/product restricted |
| API-COM-02 | `createOrder` | `commerce.self` + verified email | `{ offeringId, couponCode?, paymentMethod: 'manual_upi'\|'manual_bank', billing: { name, email, country, company?, address?, gstNumber? } }` (D-410) | `{ orderId, orderNo, payment: { paymentId, method, instructions: UpiInstructions \| BankInstructions }, expiresAt }` | `orders(status='pending_payment', expires_at=now+7d, tax_rate_bps, billing_snapshot, fx_rate_to_inr)`, `order_items(ownership_id = active ownership)`, `coupon_redemptions` (counted on paid), `payments(status='initiated', instructions)`; `customer_profiles` billing upserted; `N: order.created`; `E: order-created` (instructions + reference form link); `A: checkout_start` | — | `DUPLICATE_PURCHASE` (BR-10), `STATE_INVALID` method not enabled on offering, `EMAIL_UNVERIFIED`, `RATE_LIMITED`; idempotent per §1.5 |
| API-COM-03 | `cancelMyOrder` | `commerce.self` | `{ orderId }` | `{ order }` | `orders.status='cancelled', cancelled_at`; `payments` still `initiated`/`submitted` → `failed(reason='cancelled')` | — | `STATE_INVALID` unless `pending_payment` |
| API-COM-04 | `retryPayment` | `commerce.self` | `{ orderId, paymentMethod }` | same as API-COM-02 payment part | new `payments` row `initiated`; previous `failed` remains (D-416) | — | `STATE_INVALID` unless order `pending_payment` and no `submitted` payment; `ORDER_EXPIRED` |
| API-COM-05 | `listMyOrders` / `getMyOrder` (query) | `commerce.self` | list params; `{ orderNo }` | `OrderSummary[]` / `{ order, items, payments (instructions + reference), invoice?, entitlements[], instructionsHtml (A-601) }` | — | — | `NOT_FOUND` |
| API-COM-06 | `listOrdersAdmin` / `getOrderAdmin` (query) | `orders.read` | filters `status, type, userId, productId, dateFrom, dateTo, q (orderNo/email)`; sort `createdAt, total, status` | rows with payment state, shortfall, allocation summary | — | — | — |
| API-COM-07 | `createManualOrder` | `orders.manual.write` | `{ type: 'product'\|'project', customer: { userId } \| { clientName, clientEmail, clientCompany? }, currency, items: [{ offeringId } \| { description, unitMinor, quantity, splitSnapshot: { companyCutBps, lines: [{ partnerId, shareBps }] } (project lines; shares sum to 10000) }], discountMinor?, taxEnabled, billing, notes?, payment?: { method: 'manual_bank'\|'manual_upi', amountReceivedMinor, reference, paidOn } }` (D-1107, A-502) | `{ orderId, orderNo, approvalRequestId?, paymentId?, invoiceId? }` | `orders(created_by=admin)`, `order_items(split_snapshot)`; a `project` order also creates `approval_requests(type='project_order.split', payload:{orderId})` and `N: approval.requested` — the order cannot be invoiced or paid until it is applied (BR-05, MASTER_SPEC §7 "Project order splits"); a `product` manual order with `payment` supplied is created and confirmed in one transaction (runs API-PAY-03 internally → ledger, allocations, invoice, entitlements for offering lines); for project orders the payment is recorded later via API-PAY-03 (or `payment` here is refused with `STATE_INVALID` until the split is applied); ledger posting for project lines uses `split_snapshot` exactly like an ownership version | `project_order.split` (project orders) | `VALIDATION` (project lines need `description` and `splitSnapshot`; product lines need `offeringId`), `STATE_INVALID` (payment before split applied), `DUPLICATE_PURCHASE` |
| API-COM-14 | `applyProjectOrderSplit` (internal) | system | approval payload | — | marks the order's `split_snapshot` approved (`approval_request_id` stored on the order); enables API-COM-11 / API-PAY-03 for that order; `N: approval.approved` to requester | — | — |
| API-COM-08 | `upsertCoupon` / `deactivateCoupon` / `listCoupons` | `orders.manual.write` | `{ id?, code, kind: 'percent'\|'fixed', value (bps \| minor), currency? (fixed), startsAt?, endsAt?, maxRedemptions?, firstPurchaseOnly, productIds?: uuid[], active }` (A-401) | `{ coupon }` | `coupons` | — | `CONFLICT` code |
| API-COM-09 | `createCustomQuote` / `sendCustomQuote` / `cancelCustomQuote` | `orders.manual.write` | `{ customerId, offeringId?, title, description, currency (base), amountMinor, expiresAt }` (D-520) | `{ quoteId, token, payUrl: /quote/<token> }` (MASTER_SPEC §7 "Auth and checkout URLs") | `custom_quotes(status draft→sent)`; send: `N: quote.sent`, `E: custom-quote` | — | `STATE_INVALID` |
| API-COM-10 | `getQuote` (query) / `acceptCustomQuote` | `getQuote`: any session on `/quote/[token]` (logged-out → login, then back to the quote, BR-03); `acceptCustomQuote`: `commerce.self` with `session.user.id = custom_quotes.customer_id` | `{ token }`; `{ token, paymentMethod, billing }` | quote view `{ quote, canAccept: boolean }` / same as API-COM-02 | accept: `custom_quotes.status='accepted', order_id`; creates order with `custom_quote_id`, single item at quoted amount (coupons not applicable). When the session user is not the invited customer the quote is returned read-only (`canAccept=false`) and the UI shows a "sign in as the invited customer" prompt (MASTER_SPEC §7 "Custom quote pay link") | — | `NOT_FOUND`, `ORDER_EXPIRED` (quote `expires_at`), `FORBIDDEN` (accept by a different account), `STATE_INVALID` |
| API-COM-11 | `issueInvoice` (internal + manual re-issue) | system on paid; `invoices.issue` for project orders created without payment | `{ orderId }` | `{ invoiceId, invoiceNo, pdfMediaId }` | `invoice_sequences` row-locked (BR-16), `invoices` (seller/buyer snapshots, `gst_breakdown` only when `site_settings.gstin` set, D-1501), PDF rendered via `@react-pdf/renderer` to R2 `media(private)`; `E: invoice` with PDF; `N: invoice.issued` | — | `STATE_INVALID` invoice exists (`order_id` unique) |
| API-COM-12 | `getInvoicePdfUrl` | `commerce.self` (own) / `invoices.read` | `{ invoiceId \| creditNoteId }` | `{ url (5-min presigned GET), expiresAt }` | `downloads` not used (invoices are not entitlement assets); audit for admin | — | `NOT_FOUND` |
| API-COM-13 | `listInvoicesAdmin` / `listMyInvoices` (query) | `invoices.read` / `commerce.self` | filters `fy, dateFrom, dateTo, q` | rows + credit notes | — | — | — |

Tax rule used by API-COM-01/02/07: `taxRateBps = product.tax_enabled && site_settings.gstin ? site_settings.tax_rate_bps : 0` (BR-08, D-504, D-519, D-1501); tax is added on top of the discounted line total. Charge currency is always `site_settings.base_currency` in release 1 (D-502).

### 2.4 PAY — payments and refunds (`modules/payments`, `modules/refunds` inside `payments`)

| ID | Action | Caller | Input | Output | Side effects | Approval | Failures |
|----|--------|--------|-------|--------|--------------|----------|----------|
| API-PAY-01 | `getPaymentInstructions` (query) | `commerce.self` | `{ paymentId }` | `UpiInstructions { vpa, payeeName: 'CodeKraft', amount: Money, note: orderNo, qrDataUrl, upiUri }` or `BankInstructions { accountName, accountNo, ifsc, bankName, swift?, amount: Money, reference: orderNo }` | — | — | `NOT_FOUND` |
| API-PAY-02 | `submitPaymentReference` | `commerce.self` | `{ paymentId, reference: string(6..64) (UTR / txn id), paidAt?: ISO, note?: string(0..500) }` | `{ payment: { status: 'submitted' } }` | `payments.customer_reference, customer_submitted_at, status='submitted'`; `N: payment.submitted` to all admins (in-app only, D-707); `A: payment_submitted`; audit (customer security event) | — | `STATE_INVALID` unless `initiated` (resubmission of a `submitted` payment updates reference and re-notifies, once per 10 min), `ORDER_EXPIRED` |
| API-PAY-03 | `confirmPayment` | `payments.confirm` | `{ paymentId, amountReceivedMinor: int ≥ 0, reference: string, receivedOn: YYYY-MM-DD, note? }` (D-516) | `{ payment, order, invoiceNo, entitlementIds[], ledgerEntryCount, shortfallMinor }` | In **one transaction**: `payments(status='confirmed', amount_received_minor, bank_shortfall_minor = max(0, amount_due − amount_received), customer_credit_minor = max(0, amount_received − amount_due), confirmed_by/at)` → immutable except `confirmed → refunded`; for a `project` order the `project_order.split` request must be `applied` (`STATE_INVALID` otherwise); `orders.status='paid', paid_at`; `coupons.redemptions_count`; `user_offering_purchases`; `finance.postOrderPaid()` → `ledger_entries` + `allocations` (§4.2); `invoices` (API-COM-11); `entitlements(status='active' for download/license/saas-manual with `provisioning_state='pending'` where applicable; 'pending' only for `hosted` until provisioning completes; `service`/`custom` are `active` with checklist/instructions tracked separately, docs/03 §3.4)` + `subscriptions` + `service_progress` rows + `delivery_tasks(provision)` per handler; `N: order.paid` + `E: payment-confirmed` (customer); `N: delivery.task` (admins); `A: payment_confirmed` | — (BR-13 does not list payment confirmation) | `STATE_INVALID` unless `submitted` or `initiated` (admin may confirm without a customer reference for bank transfers seen on statement), `ORDER_EXPIRED` (admin may override with `overrideExpiry: true`, audited), overpayment is not an error: `amountReceived > amountDue` stores the excess as `payments.customer_credit_minor` (shown to admins, never allocated; ledger posts on `amountDue`, MASTER_SPEC §7 "Overpayment") |
| API-PAY-04 | `failPayment` | `payments.confirm` | `{ paymentId, reason: string(1..500) }` | `{ payment, order }` | `payments.status='failed', failure_reason`; `orders.status` stays `pending_payment` (customer may retry, D-416) unless `alsoCancelOrder: true` → `cancelled`; `N: payment.failed`, `E: payment-failed` | — | `STATE_INVALID` if `confirmed` |
| API-PAY-05 | `proposeRefund` | `refunds.propose` | `{ orderId, paymentId, amountMinor (≤ confirmed amount − already refunded), reason, revokeEntitlements: boolean (default true), queryId? }` | `{ refundId, approvalRequestId }` | `refunds(row without executed_at)`, `approval_requests(type='refund.issue', payload:{refundId})`; `N: approval.requested` | `refund.issue` (BR-09, BR-13) | `STATE_INVALID` product `is_refundable=false` (override flag `policyException: true` audited), payment provider not `manual_*` (D-505), order not `paid/fulfilled/partially_refunded`; `VALIDATION` amount |
| API-PAY-06 | `applyRefund` (internal) | system | approval payload | — | `refunds.executed_by/at`; `finance.postRefund()` proportional `refund_sale/refund_discount/refund_tax/refund_company_cut/refund_partner_allocation` entries (§4.2; `gateway_fee` and `bank_charge` are never reversed, MASTER_SPEC §7 "Refund reversal scope"); `credit_notes` + PDF; `orders.status = refunded \| partially_refunded, refunded_at`; `payments.amount_refunded_minor += amount` and `payments.status='refunded'` when fully refunded (the only permitted post-confirmation change, docs/05 §12); entitlements → `revoked` (handlers: automatic for download/license, `delivery_tasks(revoke_external)` for saas/hosted, D-607); `E: refund-issued` with credit note; `N: refund.issued`; `A: refund` | — | — |
| API-PAY-07 | `listPaymentsAwaiting` (query, widget loader) | `payments.confirm` | `{ status?: 'submitted'\|'initiated' }` | rows with age, order, customer, reference | — | — | — |
| API-PAY-08 | `flagChargeback` | `payments.confirm` | `{ paymentId, note }` | `{ ok }` | `customer_profiles.tags += 'chargeback'`; entitlements revoked as API-PAY-06 (no ledger reversal until adjustment approved, D-416) | — | gateway payments only (V1.1) |

### 2.5 DEL — entitlements, downloads, subscriptions, delivery tasks (`modules/entitlements`, `delivery`, `subscriptions`)

| ID | Action | Caller | Input | Output | Side effects | Approval | Failures |
|----|--------|--------|-------|--------|--------------|----------|----------|
| API-DEL-01 | `listMyEntitlements` / `getMyEntitlement` (query) | `delivery.self` | list params; `{ entitlementId }` | `EntitlementView` = handler `render(customerView)`: status, access window, `downloads: { used, cap, files: [{ mediaId, version, name, size }] }`, `licenseKeyMasked`, `provisioning: { state, notes }`, `serviceProgress: [{ key, title, doneAt }]`, `subscription?: { periodEnd, graceUntil, status, cancelAtPeriodEnd, renewalOrderNo? }`, `instructionsHtml`, `updatePolicy`, `versions[]` | — | — | `NOT_FOUND` |
| API-DEL-02 | `issueDownloadLink` | `delivery.self` | `{ entitlementId, mediaId }` | `{ url (5-min presigned GET, `response-content-disposition`), expiresAt, downloadsRemaining }` | atomically `UPDATE entitlements SET downloads_used = downloads_used+1 WHERE downloads_used < download_cap`; `downloads(ip, user_agent)` (BR-15); audit | — | `LIMIT_EXCEEDED` cap reached (message tells the customer to contact admin, D-606), `STATE_INVALID` entitlement not `active` or access ended (D-605), `NOT_FOUND` media not in `release_files` for the product or not allowed by `update_policy` |
| API-DEL-03 | `revealLicenseKey` | `delivery.self` | `{ entitlementId }` | `{ licenseKey }` (decrypted server-side, never cached) | audit `license.revealed` | — | `STATE_INVALID` not `active`, `NOT_FOUND` no key yet |
| API-DEL-04 | `renewSubscription` | `commerce.self` | `{ entitlementId, paymentMethod, billing? }` | as API-COM-02 (`renewalOrder`) | new `orders` (`renewal` item for the same offering at current price) with `expires_at = subscriptions.grace_until` (= `current_period_end + 7 d`, so BR-10 and BR-14 coincide, MASTER_SPEC §7 "Renewal order expiry"), `subscriptions.renewal_order_id`; on confirm (API-PAY-03) the handler extends `current_period_start/end`, clears `grace_until`, `status='active'`, entitlement `active` (D-521, D-1004) | — | `STATE_INVALID` if cancelled or a renewal order is already `pending_payment` (returned instead), `DUPLICATE_PURCHASE` does not apply to renewals |
| API-DEL-05 | `cancelSubscription` | `delivery.self` | `{ entitlementId, reason? }` | `{ subscription }` | `subscriptions.cancel_at_period_end=true`; access continues to `current_period_end` (D-521); `E: subscription-cancelled`; `N: subscription.cancelled` (admins) | — | `STATE_INVALID` |
| API-DEL-06 | `listEntitlementsAdmin` / `getEntitlementAdmin` (query) | `delivery.tasks.write` | filters `status, deliveryType, productId, userId, provisioningState`; sort | rows + handler `adminActions` | — | — | — |
| API-DEL-07 | `completeProvisioning` | `delivery.tasks.write` | `{ entitlementId, notes: { loginUrl?, username?, message? }, credentialsEmail: boolean }` | `{ entitlement }` | `entitlements.provisioning_state='done', provisioning_notes`; `delivery_tasks(provision).status='done'`; `E: access-provisioned` (credentials sent by email, D-601); `orders.status='fulfilled'` when every entitlement of the order is `active` and every service checklist is complete (MASTER_SPEC §7 "Order fulfilled") | — | `STATE_INVALID` |
| API-DEL-08 | `setLicenseKey` | `delivery.tasks.write` | `{ entitlementId, licenseKey: string(8..512), installNotesJson?, notifyEmail: boolean }` | `{ entitlement }` | `entitlements.license_key_enc` (AES-GCM, key from env); `E: license-key` and `N: license.ready` both carry a link to the dashboard entitlement page — the key itself is never placed in the email or notification (D-603, D-406, MASTER_SPEC §7 "License key delivery"; founder may relax to plaintext email); order → `fulfilled` | — | — |
| API-DEL-09 | `markServiceStep` | `delivery.tasks.write` | `{ entitlementId, stepKey, done: boolean, note? }` | `{ progress[], fulfilled: boolean }` | `service_progress`; `N: service.progress` + `E: service-progress` (customer); when all steps done → `orders.status='fulfilled', fulfilled_at` (D-608) | — | `NOT_FOUND` step |
| API-DEL-10 | `listDeliveryTasks` / `completeDeliveryTask` | `delivery.tasks.write` | filters `kind, status, assignedTo`; `{ taskId, note }` | rows / `{ task }` | `delivery_tasks`; for `revoke_external` completion sets `entitlements.status='revoked'` if not already | — | — |
| API-DEL-11 | `grantEntitlement` | `entitlements.admin` | `{ userId, offeringId, accessMonths?: int\|null, reason: string(1..500) (mandatory) }` | `{ entitlementId }` | `entitlements(order_item_id = null, granted_manually_by, status='active'; `provisioning_state='pending'` for saas-manual)`; no order, invoice, ledger entry or allocation is created (D-1108, MASTER_SPEC §7 "Manual entitlement grants"); audit row with `reason`; `N: entitlement.granted_manually` to every other admin; `E: access-granted`; not dual-approved | — | `DUPLICATE_PURCHASE`, `VALIDATION` (missing reason) |
| API-DEL-12 | `revokeEntitlement` | `entitlements.admin` | `{ entitlementId, reason }` | `{ entitlement, taskId? }` | `entitlements.status='revoked', revoked_at, revoke_reason`; handler `onRevoked` (automatic vs `delivery_tasks(revoke_external)`, D-607); `E: access-revoked` | — | `STATE_INVALID` |
| API-DEL-13 | `resetDownloadCount` | `entitlements.admin` | `{ entitlementId, newCap?: int }` | `{ entitlement }` | `entitlements.downloads_used=0`, optional `download_cap` (D-606) | — | — |
| API-DEL-14 | `cancelSubscriptionAdmin` / `extendAccess` | `entitlements.admin` | `{ entitlementId, accessEndsAt \| periodEnd, reason }` | `{ entitlement }` | `entitlements.access_ends_at`, `subscriptions.current_period_end` | — | — |

### 2.6 FIN — ledger, allocations, payouts, expenses, adjustments, reports (`modules/finance`)

| ID | Action | Caller | Input | Output | Side effects | Approval | Failures |
|----|--------|--------|-------|--------|--------------|----------|----------|
| API-FIN-01 | `listLedgerEntries` (query) | `finance.ledger.read` (`read_all` for other partners' lines) | filters `entryType[], partnerId, productId, orderNo, dateFrom, dateTo, currency, approvalRequestId`; sort `seq` only | `{ items: LedgerEntry (amount: Money, amountInrMinor, fxRateToInr, memo, links), nextCursor, totals: { byType: Record<type, Money> } }` | — | — | — |
| API-FIN-02 | `getOrderAllocation` (query) | `finance.ledger.read` | `{ orderId }` | per item: gross, discount, tax, gatewayFee, bankCharge, distributable, companyCut, lines `[{ partnerId, shareBps, amount }]`, ownership version used | — | — | `NOT_FOUND` |
| API-FIN-03 | `getPartnerBalances` (query) | `finance.ledger.read` | `{ partnerId? }` | `[{ partnerId, byCurrency: [{ currency, allocated, refunded, expenses, paidOut, balance }], balanceInrMinor }]` from `VIEW partner_balances` | — | — | `FORBIDDEN` other partner without `read_all` |
| API-FIN-04 | `recordPayout` | `finance.payout.record` | `{ partnerId, amountMinor, currency, paidOn: YYYY-MM-DD, reference: string(1..120), note? }` (D-511) | `{ approvalRequestId }` | `approval_requests(type='payout.record', payload)`; `N: approval.requested` | `payout.record` (BR-13) | `VALIDATION` amount > the partner's current balance in that currency (rejected; no override — MASTER_SPEC §7 "Payout > balance") |
| API-FIN-05 | `applyPayout` (internal) | system | payload | — | `payouts` (immutable) + `ledger_entries(entry_type='payout', party_type='partner', amount negative)` with `fx_rate_to_inr` at `paidOn`; `N: payout.recorded` to the partner | — | — |
| API-FIN-06 | `recordExpense` | `finance.expense.write` | `{ productId?, category, description, amountMinor, currency, incurredOn, sharedBySplit: boolean (default true), receiptMediaId? }` (D-514) | `{ expenseId, entryIds[] }` | `expenses`; `ledger_entries(entry_type='expense')`: if `sharedBySplit` and `productId` → one negative line per partner per the ownership active on `incurredOn` (plus company line for its cut); else one `party_type='company'` line | — (not a BR-13 action) | `VALIDATION` productId without active ownership when `sharedBySplit` |
| API-FIN-07 | `proposeAdjustment` | `finance.adjustment.propose` | `{ lines: [{ partyType, partnerId?, amountMinor (signed), currency, memo, orderId?, orderItemId? }] (Σ must be explained), reason }` | `{ approvalRequestId }` | `approval_requests(type='ledger.adjustment', payload)` | `ledger.adjustment` (BR-17, D-517) | `VALIDATION` empty lines |
| API-FIN-08 | `applyAdjustment` (internal) | system | payload | — | `ledger_entries(entry_type='adjustment', approval_request_id)` (`partner_balances` is a plain view, so nothing to refresh) | — | — |
| API-FIN-09 | `getReport` (query) | `finance.reports.read` | `{ report: 'revenue_by_product'\|'revenue_by_partner'\|'revenue_by_period'\|'tax_collected'\|'refunds'\|'outstanding_payouts'\|'profit_by_product'\|'customer_credits' (from VIEW customer_credits, overpayments not yet refunded), dateFrom, dateTo, granularity?: 'day'\|'month'\|'fy', currency?: 'INR'\|'native' }` (D-513) | `{ columns, rows, totals }` (INR via `amount_inr_minor`) | — | — | — |
| API-FIN-10 | `exportStatement` | `finance.statements.export` | `{ partnerId, dateFrom, dateTo, format: 'pdf'\|'csv' }` | `{ url (5-min), filename }` | renders to R2 `media(private)`; audit | — | `FORBIDDEN` other partner (admin role) |
| API-FIN-11 | `listPayouts` / `listExpenses` (query) | `finance.ledger.read` | filters `partnerId, productId, dateFrom, dateTo` | rows | — | — | — |
| API-FIN-12 | `refreshFxRates` (admin trigger of cron) / `setFxOverride` | `settings.write` | `{ quote, rate, asOf }` | `{ rates[] }` | `fx_rates(source='manual')` (architecture §4 FX) | — | — |

### 2.7 ADM — approvals, audit, customers, settings, admin users, widget dashboard (`modules/approvals`, `audit`, `users`, `settings`, `dashboard-widgets`)

| ID | Action | Caller | Input | Output | Side effects | Approval | Failures |
|----|--------|--------|-------|--------|--------------|----------|----------|
| API-ADM-01 | `listApprovals` / `getApproval` (query) | `approvals.read` | filters `status, type, requestedBy, mine: boolean`; sort `createdAt` | `{ items: { id, type, subject, payloadSummary, requestedBy, status, decisions[], pendingApprovers[], ageHours } }` | — | — | — |
| API-ADM-02 | `approveRequest` | `approvals.decide` | `{ approvalRequestId, comment? }` | `{ status: 'approved'\|'applied'\|'pending', applied: boolean }` | `approval_decisions` (trigger: decider ≠ requester); when every current admin-class user other than the requester has approved (A-1101, BR-13) → `status='approved'` → `approvals.execute()` dispatches `apply<Type>()` in the same transaction → `status='applied', applied_at` (on failure `error` stored, status stays `approved`, retry via API-ADM-04); `N: approval.approved` to requester | — | `FORBIDDEN` own request, `STATE_INVALID` not pending, `IDEMPOTENT_REPLAY` |
| API-ADM-03 | `rejectRequest` | `approvals.decide` | `{ approvalRequestId, comment: string(1..500) }` | `{ status: 'rejected' }` | `approval_decisions(reject)`, `status='rejected'`; module `onRejected` (publish → product back to `draft`; ownership → `pending` version deleted; refund → `refunds` row deleted; payout/adjustment → nothing); `N: approval.rejected` | — | as above |
| API-ADM-04 | `cancelRequest` / `retryApply` | requester / `super_admin` | `{ approvalRequestId }` | `{ status }` | `status='cancelled'` (only while `pending`); retry re-runs `execute()` for `approved` with `error` | — | `STATE_INVALID` |
| API-ADM-05 | `listAuditLogs` (query) / `exportAuditLogs` | `audit.read` / `audit.export` | filters `actorId, action (prefix), subjectType, subjectId, dateFrom, dateTo, q`; sort `createdAt` | rows with before/after; export → CSV presigned URL (D-1104) | export itself audited | — | — |
| API-ADM-06 | `listCustomers` / `getCustomer` (query) | `customers.read` | filters `status, tag, country, hasOrders, q (name/email)`; sort `createdAt, lastOrderAt` | `{ user, profile, stats: { orders, spentInrMinor, entitlements }, timeline }` | — | — | — |
| API-ADM-07 | `updateCustomerNotes` | `customers.notes.write` | `{ userId, internalNotes?, tags?: string[] }` | `{ profile }` | `customer_profiles` (D-1108) | — | — |
| API-ADM-08 | `suspendCustomer` / `reinstateCustomer` | `customers.suspend` | `{ userId, reason }` | `{ user }` | `users.status`; sessions revoked; `E: account-suspended` | — | `STATE_INVALID` (deleted) |
| API-ADM-09 | `sendResetLink` / `sendMagicLink` | `customers.reset_link` | `{ userId, kind: 'reset'\|'magic' }` | `{ sentTo }` | Better Auth `forgetPassword` / magic-link plugin; `email_outbox`; audit | — | `RATE_LIMITED` |
| API-ADM-10 | `getSettings` (query) / `updateSettings` | `settings.read` / `settings.write` | `{ patch: Partial<{ baseCurrency, enabledCurrencies[], taxRateBps, gstin, sellerDetails: { name:'CodeKraft', address, contactPhones[], email }, upiVpa, bankDetails, enabledPaymentMethods[], defaultTheme, aiModel, aiDailyPlatformCap, aiDailyUserCap, chatTimeoutMs, retention: { chatMonths: 12, recordsYears: 7 }, flags: Record<FlagKey, boolean> }> }` | `{ settings }` | `site_settings` (one row per key); `T: settings, content`; `baseCurrency` is read-only once any `paid` order exists (`STATE_INVALID`, MASTER_SPEC §7 "Base currency lock") | — | `VALIDATION` (GSTIN format; `upiVpa` required to enable `manual_upi`) |
| API-ADM-11 | `inviteAdmin` / `changeAdminRole` / `removeAdmin` | `users.admin.manage` | `{ email, role: 'admin'\|'super_admin'\|'staff', partner?: { displayName } }` / `{ userId, role }` / `{ userId }` | `{ approvalRequestId }` | `approval_requests(type='admin.user_change')`; on apply: `user_roles`, `partners`, invite email (Better Auth invitation); the response carries `warning: 'fewer_than_two_admins'` whenever the resulting active admin-class set has < 2 members (screen shows it; dual-approval actions cannot execute until a second admin exists, MASTER_SPEC §7 "Approver set") | `admin.user_change` (BR-13) | `STATE_INVALID` removing the last super_admin or a partner holding an active share |
| API-ADM-12 | `listPartners` / `updatePartner` | `finance.ledger.read_all` | `{ partnerId, displayName?, payoutBankDetails?, active? }` | rows | `partners` (bank details encrypted) | — | — |
| API-ADM-13 | `getDashboardLayout` / `saveDashboardLayout` | `dashboard.admin` | `{ layout: [{ i: widgetKey, x, y, w, h }] }` | `{ layout, availableWidgets: [{ key, title, group, defaultSize, minSize }] }` filtered by `requiredPermission` | `dashboard_layouts` (D-120) | — | `VALIDATION` unknown widget key |
| API-ADM-14 | `loadWidgetData` | `dashboard.admin` + widget `requiredPermission` | `{ widgetKey, params?: { range?: '7d'\|'30d'\|'90d'\|'fy', currency? } }` | widget-specific JSON (architecture §7.6 list of 20 widgets: `revenue_by_period`, `revenue_by_product`, `revenue_by_partner`, `my_share`, `outstanding_payouts`, `expenses_vs_profit`, `payments_awaiting`, `publish_approvals`, `split_approvals`, `service_checklists_due`, `revocation_tasks`, `new_leads`, `pipeline_funnel`, `overdue_follow_ups`, `conversion_rate`, `open_queries`, `visits_top_products`, `chatbot_usage`, `catalog_status_counts`, `new_customers`) | read-only; not audited; cached 60 s per (user, key, params) | — | `FORBIDDEN` |

### 2.8 LEAD — leads (`modules/leads`)

| ID | Action | Caller | Input | Output | Side effects | Approval | Failures |
|----|--------|--------|-------|--------|--------------|----------|----------|
| API-LEAD-01 | `createLead` (public forms) | Visitor (Turnstile) or customer | `{ source: 'inquiry_form'\|'product_cta', name, email, phone?, company?, message: string(10..4000), serviceInterest?: string[], budgetHint?, productId? (cta), turnstileToken }` (D-315, D-704, D-808) | `{ leadId }` (no PII echoed) | `leads(status='new', turnstile_verified=true, user_id if logged in)`, `lead_activities(kind='note', 'created from …')`; `N: lead.new` to all admins; `A: inquiry_submitted` (D-1302) | — | `CAPTCHA_FAILED`, `RATE_LIMITED`, `VALIDATION` |
| API-LEAD-02 | `createLeadManual` | `leads.write` | same fields minus captcha, `source='manual'`, `assignedTo?` | `{ leadId }` | `leads`, `lead_activities` | — | — |
| API-LEAD-03 | `listLeads` / `getLead` (query) | `leads.read` (`read_all` for other admins' leads) | filters `status[], source, assignedTo ('me'\|'unassigned'\|userId), productId, priority, overdue: boolean, dateFrom, dateTo, q`; sort `createdAt, nextFollowUpAt, status` (D-706 overdue = `next_follow_up_at < now` and status not won/lost) | rows / `{ lead, activities[], linkedProduct, linkedUser, wonOrder }` | — | — | — |
| API-LEAD-04 | `assignLead` / `claimLead` | `leads.assign` | `{ leadId, assignedTo: userId \| null }` | `{ lead }` | `leads.assigned_to`, `lead_activities(assignment)`; `N: lead.assigned` to assignee (D-705) | — | `CONFLICT` if already assigned to someone else on `claim` |
| API-LEAD-05 | `updateLeadStatus` | `leads.write` | `{ leadId, status: 'new'\|'contacted'\|'qualified'\|'proposal'\|'won'\|'lost', lostReason? (required for lost), wonOrderId? }` (D-703) | `{ lead }` | `leads.status`, `lead_activities(status_change)`; `won` may link a manual order | — | `VALIDATION` |
| API-LEAD-06 | `addLeadNote` / `logLeadActivity` | `leads.write` | `{ leadId, kind: 'note'\|'email'\|'call', body: string(1..4000) }` | `{ activity }` | `lead_activities` | — | — |
| API-LEAD-07 | `setFollowUp` | `leads.write` | `{ leadId, nextFollowUpAt: ISO \| null, note?, priority? }` | `{ lead }` | `leads.next_follow_up_at, priority`, `lead_activities(follow_up_set)`; overdue items appear in the daily digest email (R-701) | — | — |

### 2.9 CHAT — queries and chatbot (`modules/queries`, `modules/chat`)

| ID | Action | Caller | Input | Output | Side effects | Approval | Failures |
|----|--------|--------|-------|--------|--------------|----------|----------|
| API-CHAT-01 | `createQuery` | customer (`support.self`) or Visitor with Turnstile (`source='form'`) | `{ subject: string(3..160), bodyJson, source: 'form'\|'dashboard'\|'order', orderId?, productId?, refundRequest?: boolean (only with `source='order'` on a `paid`/`fulfilled`/`partially_refunded` order of the caller), attachments?: mediaId[] (≤3, uploaded via intent purpose `query_attachment`), guestEmail? (visitor), turnstileToken? (visitor) }` (BR-03) | `{ queryId, existing?: boolean }` | `queries(status='open')`, `query_messages(author_kind='customer')`; `N: query.new` to admins; `A: inquiry_submitted` for visitor form. "Request refund" on the order page calls this with `refundRequest=true`: at most one open refund query per order — a second call returns the existing thread (`existing=true`) instead of creating another (BR-09, MASTER_SPEC §7 "Refund request channel") | — | `CAPTCHA_FAILED`, `RATE_LIMITED`, `STATE_INVALID` (refund request on a non-paid order) |
| API-CHAT-02 | `listMyQueries` / `getMyQuery` (query) | `support.self` | list params; `{ queryId }` | thread with messages, attachment signed URLs (5 min) | — | — | `NOT_FOUND` |
| API-CHAT-03 | `replyToQuery` | `support.self` (own, reopens `waiting_customer` → `open`) or `queries.reply` | `{ queryId, bodyJson, attachments?, setStatus?: 'waiting_customer'\|'resolved' (admins may set either; a customer may set 'resolved' on their own query) }` | `{ message, query }` | `query_messages`; admin reply → `N: query.replied` + `E: query-reply` to customer (D-702, D-1002); customer reply → `N: query.customer_replied` to assignee/admins | — | `STATE_INVALID` if `closed` |
| API-CHAT-04 | `listQueriesAdmin` / `getQueryAdmin` (query) | `queries.read` | filters `status[], source, assignedTo, userId, orderId, productId, dateFrom, q`; sort `updatedAt, createdAt` | rows / thread + customer card + linked order + originating conversation transcript | — | — | — |
| API-CHAT-05 | `assignQuery` / `closeQuery` / `reopenQuery` | `queries.reply` / `queries.close` | `{ queryId, assignedTo? }` / `{ queryId, resolutionNote? }` | `{ query }` | `queries.status/assigned_to`; close → `E: query-closed`; `N:` | — | `STATE_INVALID` |
| API-CHAT-06 | `startConversation` | `chat.use` (customer, verified) | `{ entry?: 'menu'\|'free', context?: { productSlug?, orderNo? } }` | `{ conversationId, menu: MenuNode[], usage: { userRemaining, platformRemaining } }` | `conversations(model=site_settings.ai_model, prompt_version_id=active, purge_after=today+12mo)` (D-1503); `A: chat_started` | — | `EMAIL_UNVERIFIED`, `RATE_LIMITED` |
| API-CHAT-07 | `menuIntent` | `chat.use` | `{ conversationId, intent: 'order_status'\|'downloads'\|'contact'\|'renewal'\|'invoices'\|'talk_to_human'\|'back', args?: { orderNo? } }` | `{ messages: [{ role: 'menu', content, actions: [{ label, intent \| href }] }] }` resolved from the caller's own rows via `modules/chat/menus.ts`, no LLM; `contact` resolves to "escalate to a query" (API-CHAT-09) because no public contact details exist (D-808, MASTER_SPEC §7 "Chatbot contact menu") | `chat_messages(role='menu')` | — | `NOT_FOUND` |
| API-CHAT-08 | `sendMessage` → `POST /api/chat` (§3.2) | `chat.use` | `{ conversationId, content: string(1..2000) }` | SSE stream | `chat_messages(user, assistant)`, `chat_usage_daily(user, platform)`, `retrieved_chunk_ids`; lead intent: when the model emits the side-effect-free `capture_lead` tool call the stream sends `event: lead_intent` with prefilled fields — no lead row is written until the customer confirms via API-CHAT-15 (FR-CHAT-05, docs/09 §11) | — | `LIMIT_EXCEEDED` (menu-only fallback, D-708), `UPSTREAM_UNAVAILABLE` (menu fallback) |
| API-CHAT-09 | `escalateConversation` | `chat.use` | `{ conversationId, subject?, summary?: string }` | `{ queryId }` | `queries(source='chatbot', conversation_id)`, first `query_messages` = transcript summary + last 10 turns (`author_kind='system'`) + customer's summary; `conversations.escalated_query_id, ended_at`; `N: query.new`; `A: chat_escalated` (D-702, D-1302) | — | `STATE_INVALID` already escalated |
| API-CHAT-10 | `endConversation` / `listMyConversations` | `chat.use` | `{ conversationId }` | — | `conversations.ended_at` | — | — |
| API-CHAT-11 | `listConversationsAdmin` / `getTranscript` (query) | `chat.transcripts.read` | filters `userId, escalated, dateFrom, dateTo`; | transcript with tokens + retrieved chunks; usage vs caps | — | — | — |
| API-CHAT-12 | `listPromptVersions` / `createPromptVersion` / `activatePromptVersion` | `chat.prompts.write` | `{ name, systemPrompt: string(1..20000) }` / `{ promptVersionId }` | `{ versions[] }` | `prompt_versions` (only one `is_active`); audit (architecture §9 prompt management) | — | — |
| API-CHAT-13 | `reindexKnowledge` | `chat.prompts.write` | `{ sourceType?: 'product'\|'offering'\|'service'\|'faq'\|'legal'\|'case_study' }` | `{ chunks: number }` | `knowledge_chunks` rebuild (also run by cron and on publish) | — | — |
| API-CHAT-15 | `confirmLeadCapture` | `chat.use` | `{ conversationId, name?, email?, need: string(10..2000) }` (prefilled from `lead_intent`, editable) | `{ leadId }` | `leads(source='chatbot', user_id, message=need)`; `chat_messages(role='system', 'lead captured')`; `N: lead.new` to admins; `A: chat_lead_captured` (D-704, US-46) | — | `STATE_INVALID` (conversation ended), `VALIDATION` |
| API-CHAT-14 | `createQueryAdmin` | `queries.reply` | `{ userId? \| guestEmail, subject, bodyJson, source: 'email'\|'manual', orderId?, productId?, refundRequest?: boolean }` | `{ queryId }` | `queries(status='open', source)` opened on a customer's behalf — `email` when the request arrived via the invoice contact details (D-406), `manual` otherwise; first message `author_kind='admin'`; `N: query.new` (customer) | — | `VALIDATION` |

### 2.10 CONT — content CMS-lite (`modules/content`)

All CONT actions require `content.write` (publish flags require `content.publish`); reads for the site are cached with `T: content` (`T: case-studies` for case studies).

| ID | Action | Input | Output | Side effects | Failures |
|----|--------|-------|--------|--------------|----------|
| API-CONT-01 | `upsertLandingChapter` | `{ key: 'who'\|'build'\|'sell'\|'proof'\|'talk', title, subtitle?, bodyJson, media: { posterMediaId?, videoEmbedUrl?, sceneVariant? }, cta: { primary: { label, href }, secondary? }, position, published }` (D-801, D-802) | `{ chapter }` | `landing_chapters`; `T: content` | `VALIDATION` unknown key |
| API-CONT-02 | `setFeaturedProducts` | `{ productIds: uuid[] (≤ 8, published only) }` | `{ featured[] }` | `featured_products`; `T: content, catalog` | `VALIDATION` |
| API-CONT-03 | `upsertService` / `deleteService` / `reorderServices` | `{ id?, slug, title, summary, deliverables: string[], bodyJson, icon, position, published }` (D-302, D-806) | `{ service }` | `services`; `T: content`; `knowledge_chunks` | `CONFLICT` slug |
| API-CONT-04 | `upsertCaseStudy` / `publishCaseStudy` / `unpublishCaseStudy` / `deleteCaseStudy` | `{ id?, slug, title, clientName, industry, problemJson, solutionJson, resultsJson, techStack: string[], coverMediaId, gallery: [{ mediaId, caption? }], seoTitle?, seoDescription? }` (D-803) | `{ caseStudy }` | `case_studies`; `T: case-studies, case-study:<slug>, sitemap`; `knowledge_chunks`; a slug change on a published case study inserts `slug_redirects(entity='case_study')` (blogs likewise via API-CAT-10, entity 'blog') | `CONFLICT` slug |
| API-CONT-05 | `upsertTestimonial` / `delete` / `reorder` | `{ id?, quote, authorName, authorTitle?, company?, avatarMediaId?, context: 'site'\|'product', productId?, position, published }` | `{ testimonial }` | `testimonials`; `T: content` (+ `product:<slug>`) | — |
| API-CONT-06 | `upsertClientLogo` / `delete` / `reorder` | `{ id?, name, mediaId, url?, position, published }` | `{ logo }` | `client_logos`; `T: content` | — |
| API-CONT-07 | `upsertFaq` / `delete` / `reorder` | `{ id?, question, answerJson, scope: 'site'\|'chatbot'\|'product', productId?, position, published }` | `{ faq }` | `faqs`; `T: content`; `knowledge_chunks` | — |
| API-CONT-08 | `updateLegalPage` / `publishLegalPage` | `{ key: 'privacy'\|'terms'\|'refunds'\|'license', title, bodyJson }` (D-807) | `{ page, version }` | `legal_pages.version += 1, published_at`; `T: content`; `knowledge_chunks`; refund page copy must state gateway non-refundability (R-502) | — |
| API-CONT-09 | Public content reads (query): `getLandingContent`, `listServices`, `listCaseStudies` / `getCaseStudyBySlug`, `listTestimonials(context)`, `listClientLogos`, `listFaqs(scope)`, `getLegalPage(key)` | — (Visitor) | published rows only; rich text rendered to sanitised HTML server-side (ADR-10); JSON-LD `Organization` on landing, `BreadcrumbList` on detail pages | cached per §1.10 | `NOT_FOUND` |

### 2.11 NOTIF — notifications (`modules/notifications`)

| ID | Action | Caller | Input | Output | Side effects | Failures |
|----|--------|--------|-------|--------|--------------|----------|
| API-NOTIF-01 | `listNotifications` (query) | any session | `{ unreadOnly?: boolean, cursor?, limit? }` | `{ items: [{ id, type, title, body, link, payload, readAt, createdAt }], unreadCount, nextCursor }` | — | — |
| API-NOTIF-02 | `pollNotifications` (`GET /api/notifications?since=<ISO>`, also callable as a query) | any session (`poll` rate class) | `{ since: ISO }` | `{ items (created after `since`), unreadCount, serverTime }` — admin shell every 10 s, customer dashboard every 30 s, focus refetch (architecture §7.5, D-707) | — | — |
| API-NOTIF-03 | `markRead` / `markAllRead` | any session | `{ notificationIds: uuid[] }` / — | `{ unreadCount }` | `notifications.read_at` (own rows only) | `NOT_FOUND` |
| API-NOTIF-04 | `getNotificationPreferences` / `updateNotificationPreferences` | `account.self` (customer) | `{ email: { orderUpdates: true (locked), productUpdates: boolean, marketing: false (absent in R1) } }` | `{ prefs }` | `customer_profiles.notification_prefs` jsonb (docs/05 T-customer_profiles); admin channel is in-app only and not configurable (D-707, X-012) | — |

Notification types emitted (`notifications.type`): `order.created`, `order.paid`, `payment.submitted`, `payment.failed`, `invoice.issued`, `delivery.task`, `service.progress`, `license.ready`, `subscription.reminder`, `subscription.grace`, `subscription.suspended`, `subscription.cancelled`, `refund.issued`, `approval.requested`, `approval.approved`, `approval.rejected`, `lead.new`, `lead.assigned`, `lead.overdue_digest`, `query.new`, `query.replied`, `query.customer_replied`, `product.published`, `product.updated`, `quote.sent`, `entitlement.granted_manually`, `chat.cap_reached`, `system.job_failed`, `system.fx_stale`.

### 2.12 DASH — customer dashboard aggregate reads (`modules/users/queries.ts`)

| ID | Query | Caller | Output |
|----|-------|--------|--------|
| API-DASH-01 | `getDashboardOverview` | customer | `{ activeEntitlements: EntitlementView[] (≤5), pendingOrders, upcomingRenewals: [{ entitlementId, product, periodEnd, graceUntil }], openQueries, unreadNotifications, wishlistCount }` (D-1001) |
| API-DASH-02 | `getPaymentHistory` | customer | `{ items: [{ orderNo, paymentId, method, status, amountDue, amountReceived, reference, submittedAt, confirmedAt }] }` |
| API-DASH-03 | `getSecurityOverview` | customer | `{ sessions[], emailVerified, authMethods: ('password'\|'google'\|'phone')[], lastLoginAt }` |

### 2.13 OPS — analytics ingest, ops reads (`modules/analytics`)

| ID | Action | Caller | Input | Output | Side effects | Failures |
|----|--------|--------|-------|--------|--------------|----------|
| API-OPS-01 | `trackEvent` | Visitor/customer (`analytics` rate class) | `{ name: enum (D-1302: 'product_view','wishlist_add','checkout_start','payment_submitted','payment_confirmed','inquiry_submitted','signup','login','chat_started','chat_escalated','chat_lead_captured','page_view'), productId?, orderId?, props?: Record<string, string\|number\|boolean> (≤ 20 keys, ≤ 2 KB), anonId?: string(uuid) }` | `{ ok }` | `analytics_events` (server-side events such as `payment_confirmed` are written by their own actions; client may only send view/funnel-start events — server rejects server-only names with `FORBIDDEN`) | `VALIDATION`, `RATE_LIMITED` |
| API-OPS-02 | `listJobRuns` (query) | `settings.read` | filters `job, status, dateFrom` | `job_runs` rows, last run per job, missed windows | — | — |
| API-OPS-03 | `getSystemHealthWidget` (query) | `dashboard.admin` | — | `{ jobs, fxAgeDays, emailOutbox: { queued, failed }, chatUsage, sentryLink }` | — | — |

---

## 3. Route Handlers (`app/api/**`)

Common: JSON bodies (`Content-Type: application/json`) except uploads; responses use the §1.4 error object; `X-Request-Id` echoed; CORS disabled (same-origin only) except `/api/webhooks/*` and `/api/health`; `Cache-Control: no-store` on all except `/api/og/*`.

### 3.1 `/api/auth/[...all]` — Better Auth (ADR-03)
Delegated entirely to `auth.handler`. Enabled flows and their `RATE_LIMITED` class `auth`:

| Flow | Path (POST unless noted) | Notes |
|------|--------------------------|-------|
| Email + password sign-up | `/sign-up/email` | Sends verification email (`E: verify-email`); `email_verified=false` until link clicked (D-1201) |
| Email verification | `GET /verify-email?token` | Redirects to `/account`; audit `auth.email_verified` |
| Sign-in / sign-out | `/sign-in/email`, `/sign-out` | On sign-in, hook deletes other sessions (D-1203) and writes audit; sets `SameSite=Lax`, host-only cookie per host (architecture §8) |
| Google OAuth | `/sign-in/social` (provider `google`), `GET /callback/google` | Pre-verified (D-1201) |
| Password reset | `/forget-password`, `/reset-password` | Email link; magic link for admin-initiated `sendMagicLink` (API-ADM-09) |
| Two-factor (TOTP) | `/two-factor/enable`, `/verify-totp`, `/disable`, backup codes | Admin roles only; enforced by `before` hook (D-1202) |
| Phone OTP | `/phone-number/send-otp`, `/verify` | Registered only when flag `phone_otp` is on (D-1603); returns 404 otherwise |
| Session | `GET /get-session`, `/list-sessions`, `/revoke-session` | `expiresIn` 30 min admin host / 60 min site host with `updateAge` sliding |
| Change email / password | `/change-email`, `/change-password` | Wrapped by API-AUTH-05 |

Roles are **not** stored in the session token; `requireContext` loads `user_roles` per request (revocation is immediate).

### 3.2 `POST /api/chat` — streaming chatbot (architecture §6, §9)
- Auth: customer session, verified email (BR-03, D-205). Body: `{ conversationId: uuid, content: string(1..2000) }`.
- Pre-flight in order: rate class `chat` → `chat_usage_daily` caps (user then platform, D-708) → conversation ownership → retrieval (`knowledge_chunks` top-8 by `ts_rank`) → `LLMProvider.stream()` with the active `prompt_versions` system prompt, `max_tokens 600`, 20 s timeout, and a single side-effect-free tool `capture_lead({ name?, email?, need })` that only signals project intent (docs/09 §11).
- Response `200 text/event-stream`, events: `event: meta` `{ messageId, usage: { userRemaining, platformRemaining } }` → `event: delta` `{ text }` (many) → optional `event: citations` `{ chunks: [{ title, sourceType, href }] }` → optional `event: lead_intent` `{ name?, email?, need }` (the client shows a confirm card; API-CHAT-15 creates the lead) → `event: done` `{ tokensIn, tokensOut, stopReason }`. On refusal/timeout/provider error: `event: fallback` `{ menu: MenuNode[], reason: 'refusal'\|'timeout'\|'unavailable' }` then `done` (architecture §9 refusal handling). Cap reached before the call: HTTP 200 with a single `fallback` event `reason: 'limit'` (so the widget stays usable) and `N: chat.cap_reached` to admins once per day.
- Persistence after stream close: `chat_messages` (user + assistant with `tokens_in/out`, `retrieved_chunk_ids`), `chat_usage_daily` increments (incremented before the call, decremented if the provider fails before first token).
- Errors: 401 `UNAUTHENTICATED`, 403 `EMAIL_UNVERIFIED`, 404 `NOT_FOUND`, 429 `RATE_LIMITED`.

### 3.3 `GET /api/cron/frequent` and `GET /api/cron/daily` — scheduled jobs (architecture §4 Jobs, MASTER_SPEC §7 "Cron on free tier")
- Two consolidated endpoints. `frequent` runs every 15 min, `daily` once a day (03:00 IST). On Vercel Hobby (daily crons only) both are fired by the GitHub Actions `scheduler.yml` workflow (`curl -H "Authorization: Bearer $CRON_SECRET"`); on Vercel Pro by Vercel Cron; in containers by `jobs/scheduler.ts` (node-cron, `RUN_SCHEDULER=true`, D-1401). Job keys and the endpoint → job assignment are owned by docs/12 §2.3 and repeated here.
- Auth: header `Authorization: Bearer <CRON_SECRET>`; constant-time compare; 401 otherwise.
- Every run inserts one `job_runs(job, started_at)` row per job then `status ok|error` with `detail`; a job is skipped (`{ skipped: true }`) if an `ok` run exists in the same window. Jobs are idempotent by construction (state-guarded updates). Failures raise `N: system.job_failed` to super admins and Sentry.

| Endpoint | Job key | Work | Writes |
|----------|---------|------|--------|
| `frequent` | `publish.scheduled` | `products.status='scheduled' AND publish_at <= now` → `published` (via API-CAT-12 path); `T:` tags | products, knowledge_chunks |
| `frequent` | `orders.expire` | `orders.status='pending_payment' AND expires_at < now` → `failed(reason='expired')` (BR-10, D-412, MASTER_SPEC §7 "Order failed"); their `initiated/submitted` payments → `failed('expired')`; `E: order-expired`. Renewal orders expire at `grace_until` by construction (API-DEL-04) | orders, payments, notifications |
| `frequent` | `quotes.expire` | `custom_quotes.status='sent' AND expires_at < now` → `expired` | custom_quotes |
| `frequent` | `email.outbox_retry` | send `queued` rows via Resend, exponential back-off, max 5 attempts (architecture §10) | email_outbox, notifications.channel_state |
| `frequent` | `invoices.regenerate_pending` | render PDFs for `invoices`/`credit_notes` rows with `pdf_media_id IS NULL` (R2 outage, webhook-deferred rendering) | media, invoices, email_outbox |
| `frequent` | `retention.purge_tokens` | delete expired `verifications`, unconsumed expired `files_upload_intents` | verifications, files_upload_intents |
| `daily` | `subscriptions.remind_grace_suspend` | `current_period_end` in 7 d and 1 d and `reminder_sent_at` not in window → `N: subscription.reminder` + `E: renewal-reminder` (D-521, D-1004); period ended, not renewed, not cancelled → `status='past_due'`, `grace_until = period_end + 7 d`, entitlement stays `active`, `E: renewal-grace`; `grace_until < now` → subscription and entitlement `suspended`, handler `onRevoked(soft)`; `cancel_at_period_end` and period ended → `cancelled`, entitlement `expired` (BR-14, MASTER_SPEC §7 "Subscription grace") | subscriptions, entitlements, delivery_tasks, notifications, email_outbox |
| `daily` | `entitlements.expire` | one-time entitlements with `access_ends_at < now` → `expired` (D-605) | entitlements |
| `daily` | `fx.refresh` | fetch `open.er-api.com` base INR → `fx_rates`; `N: system.fx_stale` if last success > 3 d | fx_rates |
| `daily` | `knowledge.reindex` | rebuild `knowledge_chunks` from published sources | knowledge_chunks |
| `daily` | `retention.purge` | delete `chat_messages/conversations` with `purge_after < today` (D-1503) | chat tables |
| `daily` | `finance.reconcile` | nightly ledger reconciliation (NFR-DATA-04): Σ entries per order = 0 at party level, allocations = distributable, `partner_balances` = Σ entries; discrepancies → `N: finance.reconcile_failed` to admins | ledger_entries, allocations |
| `daily` | `queries.auto_close` | close queries in `waiting_customer` with no customer reply for 7 days (FR-LEAD-09); `E: query-closed` | queries |
| `daily` | `users.anonymise` | safety sweep only: any `users.status='deleted'` row with `anonymized_at IS NULL` is anonymised (normally none — anonymisation happens inside the API-AUTH-08 transaction, BR-18, MASTER_SPEC §7) | users |
| `daily` | `admin.overdue_digest` | overdue leads and open `revoke_external` tasks per admin → one `E: overdue-follow-ups` digest + `N: lead.overdue_digest` (R-701, D-706, D-607) | email_outbox, notifications |
| `daily` | `vitals.rollup` | p75 per metric per route for the System widget (docs/11 §B13) | analytics_events |
| `daily` | `backups.verify` | checks last night's dump exists in R2 (docs/12 §5.3), else `N: system.job_failed` | notifications |
| `daily` | `audit.export` (Sundays) | append-only export of `audit_logs` and `ledger_entries` to R2 `exports/` (docs/09 §5.3) | media |
| `daily` | `health.jobs_check` | flags jobs whose last `ok` run is older than 2× their interval (docs/12 §8.1) | notifications |

Balances are read from the plain SQL view `partner_balances` (docs/05 §7); no refresh job exists.

### 3.4 `/api/webhooks/*` — reserved
| Path | Status in R1 | Contract |
|------|--------------|----------|
| `POST /api/webhooks/resend` | Live | Verifies Svix signature; events `email.delivered`, `email.bounced`, `email.complained` → `email_outbox.status`, `notifications.channel_state.email`; bounce marks `users` note `email_bounced` (no automatic suspension). Idempotent on Svix `id`. Returns 200 always after signature check. |
| `POST /api/webhooks/razorpay`, `/stripe`, `/paypal` | Registered only when the matching flag is on (V1.1, D-501) | Verifies provider signature → `webhook_events(provider, event_id)` unique insert (dup → 200 no-op) → `PaymentProvider.handleWebhook()` → on success event calls `payments.confirm()` (same code path as API-PAY-03) with `amountReceived = captured amount`, `gatewayFee` from payload; on failure calls `payments.fail()`. Returns 200 within 5 s; heavy work inside the transaction is bounded (no PDF rendering inline — invoice PDF generation is deferred to `email-outbox` job when invoked from a webhook). |

### 3.5 Files — presigned flows (architecture §6 "Files", A-1202)
**`POST /api/files/upload-intent`** — auth: `media.upload` (admin) or customer for `purpose` in `query_attachment`, `avatar`.
Request `{ purpose: 'product_image'\|'product_screenshot'\|'product_video'\|'product_presentation'\|'product_attachment'\|'release_file'\|'content_media'\|'expense_receipt'\|'query_attachment'\|'avatar', filename, mime, sizeBytes, checksumSha256? }`.
Validation per purpose (mime allow-list, max size: images 10 MB, PDF 25 MB, video 200 MB (A-1402 caps), release files 2 GB, attachments 20 MB). Response `{ intentId, uploadUrl (presigned PUT, 15 min), objectKey, headers: { 'Content-Type' } , visibility }`. Writes `files_upload_intents`.
**`POST /api/files/upload-intent/<intentId>/complete`** — server `HEAD`s the object, verifies size/mime/checksum, inserts `media(visibility, width, height, blur_hash)` (`blur_hash` computed server-side for image MIME types, docs/05 T-media; `public` for product images/screenshots/content/avatars via the public R2 domain, `private` otherwise), marks intent `consumed`. Response `{ mediaId, url? (public only) }`. Errors: 404, 409 `STATE_INVALID` (consumed/expired), 400 `VALIDATION` (object mismatch; object deleted).

**`GET /api/files/download/[entitlementId]/[mediaId]`** — auth: customer session owning the entitlement. Runs API-DEL-02 (cap check, `downloads` row) and responds `302` to the 5-minute presigned GET (never proxies bytes). Errors as JSON: 401/403/404, 409 `STATE_INVALID`, 429 `LIMIT_EXCEEDED`. Rate class `download`. Presigned URLs are single-purpose: `response-content-disposition=attachment; filename="<product>-<version>.<ext>"`.

**`GET /api/files/private/[mediaId]`** — admin only (`catalog.read` or `invoices.read` by media purpose): 302 to a 5-minute presigned GET for private media (invoices, statements, receipts, attachments); audited.

### 3.6 `GET /api/og/[type]/[slug]` — OG images (A-1301)
`type ∈ product | blog | case-study | page`. Renders `next/og` `ImageResponse` 1200×630 from published data (title, short description, cover, theme tokens); `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`; 404 for unpublished. Admin-uploaded `og_image_media_id` takes precedence (redirect 302 to the public media URL).

### 3.7 `GET /api/health`
Unauthenticated. `200 { status: 'ok', version, db: 'ok', time }` after `SELECT 1`; `503 { status: 'degraded', db: 'error' }` on failure. No dependency probes beyond the database (used by uptime ping, A-1401).

### 3.8 `GET /api/notifications`
Documented as API-NOTIF-02; exists as a Route Handler so TanStack Query can poll it with `fetch` on both hosts (the admin host rewrite maps `/api/*` unchanged).

---

## 4. Payment provider contract (architecture §7.1, A-402, MASTER_SPEC §4.4)

### 4.1 Interface (`modules/payments/providers/types.ts`)
```ts
export type PaymentMethodKey = 'manual_upi' | 'manual_bank' | 'razorpay' | 'stripe' | 'paypal';

export interface PaymentProvider {
  readonly keys: PaymentMethodKey[];                      // methods this provider serves
  createIntent(ctx: TxCtx, order: OrderForPayment, method: PaymentMethodKey): Promise<{ instructions: PaymentInstructions; providerPayload?: Json }>;
  confirm(ctx: TxCtx, payment: PaymentRow, input: ConfirmInput): Promise<PaymentResult>;   // returns amounts; NEVER writes ledger/orders
  refund?(ctx: TxCtx, payment: PaymentRow, amountMinor: number, reason: string): Promise<RefundResult>;
  handleWebhook?(req: Request): Promise<WebhookOutcome>;  // gateways only; returns a typed event, side-effect free
}
type ConfirmInput = { amountReceivedMinor: number; reference: string; receivedOn: string; gatewayFeeMinor?: number; actorId: string | 'webhook' };
type PaymentResult = { status: 'confirmed' | 'failed'; amountReceivedMinor: number; gatewayFeeMinor: number; bankShortfallMinor: number; customerCreditMinor: number; reference: string; providerPayload?: Json; failureReason?: string };
```
`modules/payments/service.ts` owns the orchestration: `service.confirm(paymentId, input)` → loads the provider by `payments.provider` → `provider.confirm()` → writes `payments` → `orders` → `finance.postOrderPaid()` → `invoices.issue()` → `entitlements.grantForOrder()`. The order, finance, invoice and entitlement modules receive only `{ amountReceivedMinor, gatewayFeeMinor, bankShortfallMinor, customerCreditMinor }` and never see the provider key (MASTER_SPEC §4.4).

### 4.2 `ManualProvider` behaviours (release 1, D-501, D-516)
| Method | Behaviour |
|--------|-----------|
| `keys` | `['manual_upi','manual_bank']` (one class, two methods) |
| `createIntent` (`manual_upi`) | Reads `site_settings.upi_vpa`; builds `upi://pay?pa=<vpa>&pn=CodeKraft&am=<total in rupees with 2 dp>&cu=INR&tn=<orderNo>`; renders QR via `qrcode` to a data URL; returns `UpiInstructions` (§2.4 API-PAY-01). Refuses when base currency ≠ INR (`STATE_INVALID`). |
| `createIntent` (`manual_bank`) | Returns `BankInstructions` from `site_settings.bank_details` with `reference = orderNo`. Any enabled currency (customer wires in base currency). |
| `confirm` | Pure computation: `bankShortfallMinor = max(0, amountDue − amountReceived)`, `customerCreditMinor = max(0, amountReceived − amountDue)` (overpayment is recorded on the payment and shown to admins, never allocated — MASTER_SPEC §7 "Overpayment"), `gatewayFeeMinor = 0`, `status = 'confirmed'`. The admin-supplied `reference` overrides the customer's if different (both kept: customer's in `customer_reference`, admin's in `provider_payload.adminReference`). |
| `refund` | Records `{ status: 'recorded', reference: input.reference }`; the actual transfer is done by hand and the reference typed by the admin (BR-09). |
| `handleWebhook` | Absent. |

Ledger posting on confirm (`finance.postOrderPaid`, per order item, BR-06): `distributable = gross − discount − tax − gatewayFee − bankShortfall` (shortfall and fee spread across items pro-rata by item total); `company = distributable × company_cut_bps / 10000`; partner lines = `(distributable − company) × share_bps / 10000` with the largest-remainder method so Σ lines + company = distributable exactly in minor units; an overpayment (`customer_credit_minor`) is excluded from gross; for `project` lines the company cut and lines come from the approved `order_items.split_snapshot` (approval `project_order.split`) instead of an ownership version; for product lines the ownership version = `order_items.ownership_id` captured at order creation, re-validated as still the active version at confirm time (if superseded meanwhile, the version **active at payment time** wins, BR-05, and `order_items.ownership_id` is updated before posting — the only permitted update on that column).

### 4.3 Gateway plug-in (V1.1, D-501)
`RazorpayProvider` / `StripeProvider` / `PayPalProvider` implement `createIntent` (returns `{ instructions: { kind: 'redirect'|'client_sdk', ... } }`), `handleWebhook` (signature check + event mapping), `confirm` (reads captured amount and fee from the event, sets `bankShortfall = 0`), `refund` (API call; D-505 keeps gateway refunds disabled by policy — `refund` exists for chargeback reconciliation only). Registration: `providers/registry.ts` maps key → provider, gated by `provider_*` flags; offerings expose the method via API-CAT-05. Nothing in `orders`, `finance`, `invoices`, `entitlements` changes. Webhook → `service.confirm()` is the same function admins call, so idempotency and audit (actor `webhook:<provider>`) are shared.

---

## 5. Sequences

### 5.1 Checkout → manual payment → confirm → ledger → entitlement → delivery
1. Customer (verified, BR-03) opens `/products/<slug>` (API-CAT-31) and picks an offering → `/checkout/<offeringId>`; `previewCheckout` (API-COM-01) applies coupon and tax, checks BR-10.
2. `createOrder` (API-COM-02): transaction writes `orders(pending_payment, expires_at +7d)`, `order_items(ownership_id = active)`, `payments(initiated)` with `ManualProvider.createIntent` instructions; `E: order-created`; `A: checkout_start`.
3. Customer pays by UPI QR or bank transfer outside the platform, then `submitPaymentReference` (API-PAY-02) → `payments.submitted`; admins get `N: payment.submitted` (poll ≤10 s).
4. Admin opens the order (API-COM-06), checks the bank/UPI statement, runs `confirmPayment` (API-PAY-03) with `amountReceived`; if the customer never submits, the admin may still confirm from the statement.
5. In one transaction: `payments.confirmed` (immutable), `orders.paid`, `user_offering_purchases`, coupon count, `finance.postOrderPaid` (§4.2) → `ledger_entries` (`sale`, `discount`, `tax_collected`, `gateway_fee` 0, `bank_charge`, `company_cut`, `partner_allocation` ×n) + `allocations`; `invoices` numbered under `invoice_sequences` lock; `entitlements` per item via handler `onGranted`; `subscriptions` row for subscription offerings; `service_progress` rows for `service`; `delivery_tasks(provision)` for `saas/hosted` manual provisioning; audit; `E: payment-confirmed` + `E: invoice`; `N: order.paid`; `A: payment_confirmed`.
6. Delivery per type (§2.5): `download` → immediately `active`, customer issues links (API-DEL-02); `license` → admin `setLicenseKey` (API-DEL-08); `saas/hosted` → admin `completeProvisioning` (API-DEL-07); `service` → admin ticks steps (API-DEL-09); `custom` → instructions shown, admin marks fulfilled via API-DEL-07 semantics.
7. When every item's handler reports fulfilled, `orders.fulfilled` (`fulfilled_at`); customer sees status in dashboard (API-DASH-01).
8. If unpaid after 7 days, cron `orders.expire` sets the order `failed` (BR-10, MASTER_SPEC §7 "Order failed"); customer can start again.

### 5.2 Refund
1. Customer clicks "Request refund" on the order page → API-CHAT-01 with `source='order'`, `refundRequest=true` (one open refund query per order; BR-09, MASTER_SPEC §7 "Refund request channel"); a request that arrives by email via the invoice contact details is logged by an admin with API-CHAT-14 (`source='email'`).
2. Admin reviews: product `is_refundable`, payment `manual_*`, amount; runs `proposeRefund` (API-PAY-05) → `refunds` row + `approval_requests(refund.issue)`; requester cannot approve.
3. Other admin(s) `approveRequest` (API-ADM-02) → `applyRefund` (API-PAY-06) in the same transaction: proportional `refund_*` entries for sale, discount, tax, company cut and each partner allocation (reversal = original × refundAmount / gross; gateway fees and bank charges are never reversed), `payments.amount_refunded_minor` (+ `confirmed → refunded` when fully refunded), `credit_notes` + PDF, `orders.refunded|partially_refunded`, entitlements `revoked` via handlers, `delivery_tasks(revoke_external)` where needed.
4. Admin transfers money by hand; the reference is captured on the refund row through `ManualProvider.refund` at execute time (form field on approval) — the ledger never waits for the transfer.
5. Customer gets `E: refund-issued` with the credit note; query is closed with a note (API-CHAT-05).

### 5.3 Subscription renewal and grace (BR-14, D-521)
1. Cron `subscriptions.remind_grace_suspend` at T−7 d and T−1 d → `N: subscription.reminder` + `E: renewal-reminder`.
2. Customer `renewSubscription` (API-DEL-04) → renewal `orders(pending_payment)` + instructions; pays; submits reference; admin confirms (API-PAY-03).
3. On confirm, the subscription handler extends `current_period_start/end` by the interval from the **previous** `period_end` (not from payment date; a renewal confirmed after suspension starts the new period at confirmation), sets `status='active'`, clears `grace_until`, re-activates a `suspended` entitlement; ledger posts like any order. The renewal order's `expires_at` equals `grace_until`, so an unpaid renewal expires exactly when the subscription suspends.
4. If period ends unpaid: cron `subscriptions.remind_grace_suspend` → `past_due`, `grace_until = +7 d`, `E: renewal-grace`; the entitlement stays `active`.
5. `grace_until` passes → `suspended`; entitlement `suspended` (downloads hidden, key hidden, `delivery_tasks(revoke_external)` for external accounts, D-607); `E: subscription-suspended`. A later confirmed renewal re-activates (step 3).
6. Cancel (API-DEL-05) sets `cancel_at_period_end`; at period end cron marks `cancelled`, entitlement `expired`; no proration.

### 5.4 Ownership change approval (BR-05)
1. Admin `proposeOwnership` (API-CAT-16) → `product_ownerships(version n+1, pending)` + lines (trigger enforces 10000 bps) + `approval_requests(ownership.change)`; `N: approval.requested`.
2. Every other admin-class user approves (API-ADM-02); a rejection (API-ADM-03) deletes the pending version.
3. On the final approval, `applyOwnershipChange` (API-CAT-17): old `active → superseded`, new `active`, `effective_from = now` (or later requested date); audit with before/after.
4. Orders created before but paid after: §4.2 rule — allocation uses the version active at payment time; `allocations` already written are never modified (BR-05, BR-17).

### 5.5 Publish approval (BR-12)
1. Admin completes product, offerings, prices, methods, media, ownership; `submitForApproval` (API-CAT-11, optional `publishAt`) → `pending_approval` + `approval_requests(product.publish)`. If the ownership version is still `pending`, its own `ownership.change` request must be approved first (or in the same sitting) — publish apply refuses (`STATE_INVALID`) without an `active` ownership.
2. Another admin reviews the preview (`/admin/products/<id>/preview` renders API-CAT-31 with draft visibility) and approves or rejects with a comment.
3. Apply (API-CAT-12): `published` (or `scheduled` until `publish_at`, flipped by cron `publish.scheduled`); `revalidateTag('catalog', 'product:<slug>', 'sitemap')`; `knowledge_chunks` refreshed; `N: product.published`.
4. Unpublish (API-CAT-13) needs no approval; archive/delete do (API-CAT-14/15).

### 5.6 Chat escalation → query (D-702)
1. `startConversation` (API-CHAT-06) → menu shown; free-text goes to `POST /api/chat` (§3.2) with retrieval and streaming; a `capture_lead` tool call only yields `event: lead_intent`; the customer confirms (API-CHAT-15) and then `leads(source='chatbot')` is created.
2. Customer picks `talk_to_human` (API-CHAT-07) or the bot offers escalation after two `fallback` events → `escalateConversation` (API-CHAT-09).
3. `queries(source='chatbot', conversation_id)` with a system message containing the transcript excerpt; `N: query.new` to admins; conversation ended.
4. Admin replies (API-CHAT-03) → customer gets `N: query.replied` + `E: query-reply`; thread continues in `/account/queries/<id>`; close via API-CHAT-05.
5. Transcript retained 12 months (`purge_after`) then removed by `retention.purge`; the query thread keeps its excerpt (7-year record class, BR-18).

### 5.7 Download issuance with cap (BR-15)
1. Dashboard lists `release_files` allowed by `update_policy` and access window (API-DEL-01).
2. Customer clicks → `GET /api/files/download/[entitlementId]/[mediaId]` (§3.5) → `issueDownloadLink` (API-DEL-02): rate check → entitlement `active` and `access_ends_at` not passed → `UPDATE … SET downloads_used = downloads_used + 1 WHERE downloads_used < download_cap RETURNING` (0 rows → `LIMIT_EXCEEDED`).
3. `downloads(ip, user_agent)` row + audit; presigned GET (5 min, buyer-bound object key, attachment disposition) → 302.
4. Cap reached → message "contact us" linking to API-CHAT-01 with `source='dashboard'`; admin `resetDownloadCount` (API-DEL-13, audited).

---

## 6. Versioning and compatibility

- **Server Actions** are versioned implicitly by deploy; Next.js rejects stale action IDs after a deploy, and the client shows a "refresh to continue" toast on `INTERNAL` with `message='ACTION_STALE'`. No path versioning.
- **Route Handlers** are unversioned in release 1; a breaking change introduces `/api/v2/...` and keeps the old path for one release. `/api/chat` SSE event names are additive only (clients ignore unknown events).
- **Zod schemas** are additive: new optional fields only; renaming a field requires accepting both for one release.
- **Enums** (`orders.status`, `entitlements.status`, `approval_requests.type`, `ledger_entries.entry_type`, `queries.source`, notification types) are append-only.
- **Provider keys** are append-only; `manual_upi`/`manual_bank` persist forever in historical `payments`.
- **What must never change** (MASTER_SPEC §4.1, BR-05, BR-17): (a) `ledger_entries`, `allocations`, `payouts`, `invoices`, `credit_notes`, confirmed `payments`, `audit_logs` are append-only — no action, job, migration or provider may UPDATE/DELETE them; corrections are `adjustment` entries under `ledger.adjustment` approval; (b) the posting formula in §4.2 (order of deductions, company cut first, largest-remainder rounding, ownership version at payment time, INR equivalent at payment-date rate) is frozen — any change is a new `entry_type` or a new posting version column, never a re-computation of existing rows; (c) invoice numbers are gapless per FY and never reused; (d) the requester of an approval is never counted as an approver; (e) money crosses every boundary as integer minor units with a currency code; (f) a confirmed payment changes only through `confirmed → refunded` + `amount_refunded_minor`.

---

## 7. Open inconsistencies

All ten items are resolved in `MASTER_SPEC.md` §7 and in the spine documents; this document is aligned to them.

1. Resolved: docs/04 §5 now lists `api/notifications/` and §7.5 polls `GET /api/notifications?since=` on both hosts (§3.8, API-NOTIF-02).
2. Resolved: refund requests come through "Request refund" on the order page, which opens a query with `source='order'` (API-CHAT-01 `refundRequest`, one open per order); email via the invoice contact details is logged by an admin with API-CHAT-14 (`source='email'`) (MASTER_SPEC §7 "Refund request channel").
3. Resolved: license keys are revealed only in the dashboard; email and in-app carry a link (API-DEL-08, MASTER_SPEC §7 "License key delivery"); docs/02/03 updated, no SMS.
4. Resolved: docs/04 §7.4 no longer lists `required_approver_role`; approvers are derived at decision time (API-ADM-02).
5. Resolved: `webhook_events(provider, event_id UNIQUE, received_at, processed_at, payload)` exists in docs/05 §11 (§1.5, §3.4).
6. Resolved: `customer_profiles.notification_prefs jsonb` exists in docs/05 §1 (API-NOTIF-04).
7. Resolved: `taxRate = 0` until a GSTIN is configured, even for `tax_enabled` products (MASTER_SPEC §7 "Tax before GST registration"); docs/02 US-26 states it.
8. Resolved: MASTER_SPEC §4.9 exempts read-only Server Actions (widget loaders, list queries) from the audit rule (§1.6, API-ADM-14); docs/09 §10 notes it.
9. Resolved: `entitlements.order_item_id` is nullable with a partial unique index (docs/05 T-entitlements); API-DEL-11 creates no synthetic order, requires a reason, notifies the other admins and posts nothing to the ledger (MASTER_SPEC §7 "Manual entitlement grants").
10. Resolved: the T-payments trigger allows exactly `confirmed → refunded` plus `amount_refunded_minor` (docs/05 §12, API-PAY-06); `order_items.ownership_id` is written once at confirm time and then frozen (docs/05 T-payments note, §4.2).
