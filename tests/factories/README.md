# Test factories (P2.9) and the seed (P2.10)

Typed builders that insert real rows through Drizzle and return what they inserted
(docs/10 §3). Every factory has the shape `create<X>(options?, db?)`; `db` defaults to the pooled
app client (`getDb()`), or pass a drizzle transaction / the `postgres` transaction from
`withRollback()` (tests/setup/db.ts) via `withFactories(tx)` so a test's rows are rolled back.

| File                 | Factories                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `context.ts`         | `toFactoryDb`, `withFactories` plumbing; deterministic `nextSeq` / `seqLabel` / `pick` / `randomInt` (`resetSequences()` = `faker.seed(1207)` equivalent, no faker dependency) |
| `users.ts`           | `createUser` (customer by default; `role` adds a `user_roles` row), `createAdmin`, `createSuperAdmin`, `createPartner`, `findUserByEmail`, `findPartnerByUserId`; every user signs in with `FACTORY_PASSWORD` (argon2id, hashed once per process) |
| `catalog.ts`         | `createCategory` (depth ≤ 2), `createProduct` (optionally with an active ownership), `createMedia` (row only, no bytes), `findProductBySlug`, `tiptapParagraph` |
| `offerings.ts`       | `createOffering` with `prices` and payment `methods`, `findOffering`, `priceIn`                   |
| `ownership.ts`       | `createOwnership` (lines must sum to 10 000 bps — the DB trigger checks), `findActiveOwnership`   |
| `commerce.ts`        | `createCoupon`, `createOrder`, `createOrderItem`, `createPayment`, `createQuote`, `createInvoice` |
| `delivery.ts`        | `createEntitlement`, `createSubscription`                                                          |
| `leads.ts`           | `createLead`, `createQuery`, `createPromptVersion`, `createConversation`                          |
| `approvals.ts`       | `createApprovalRequest`, `createApprovalDecision` (approver ≠ requester is enforced by trigger)   |
| `example-catalog.ts` | `EXAMPLE_CATALOG` — the five docs/05 §14 products as pure data — and `seedExampleCatalog()`, which inserts them (categories, offerings, prices, methods, dual-approved `active` ownership) keyed by slug |

Conventions:

- Tests reference seed products by slug (`fitdesk-pro`, `tradeflow`, `mis-portal`,
  `resume-portfolio-website`, `ecommerce-website`), never by id.
- Ownership splits follow docs/10 §3: FitDesk Pro 60/40 with a 10 % company cut, TradeFlow
  100 % CFO, the other three 50/50 with 0 % cut.
- Integration tests wrap each case in `withRollback()`; `truncateAll()` resets committed state.
- P2 inserts through Drizzle because the services do not exist yet; P3–P6 swap the bodies for
  `service.ts` calls without changing these signatures.

## The seed (`pnpm db:seed`, scripts/seed.ts)

`scripts/seed/*` reuses these factories (it is the only non-test consumer): `seedExampleCatalog`
for the catalog, `createUser`/`createPartner` for the docs/10 §3 test users
(`buyer@`, `unverified@`, `suspended@`, `partner@codekraft.test`). The seed additionally writes
permissions, the Super Admins (through Better Auth), content, settings, the active prompt version
and today's FX rates; `--production` writes only permissions, Super Admins + partners and
settings. Every seeded content title is prefixed `[PLACEHOLDER]` so the launch checks can find
copy that was never edited. `pnpm db:anonymise` (scripts/seed/anonymise.ts) strips customer PII
from a non-production copy. Seeds are data only: nothing under `src/**` imports `scripts/**`
(D-018).
