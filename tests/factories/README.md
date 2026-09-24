# Test factories (P2)

This directory is reserved for typed factories (docs/10 §3) — `makeUser()`, `makeProduct()`,
`makeOffering()`, `makeOrder()`, `makePayment()`, `makeOwnership()`, `makeLead()` — one file per
module, added in P2 alongside the schema and migrations.

Conventions once they land:

- `@faker-js/faker` seeded with `faker.seed(1207)` for deterministic data.
- Every factory inserts through the module `service.ts`, never raw SQL (immutability tests are the
  only exception).
- Tests reference seed products by slug, never by id.
- Integration tests wrap each case in `withRollback()` from `tests/setup/db.ts`; e2e resets the DB
  from a snapshot per spec file.
