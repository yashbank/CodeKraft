---
name: neon-migration
description: Create and test a Drizzle migration against Neon/local Postgres for CodeKraft. Use whenever a fix or feature (e.g. Razorpay settings table) needs a schema change. Never run production migrations directly.
---

1. Edit the Drizzle schema file(s), then generate with `drizzle-kit generate`.
2. Test the migration only against local Postgres (`pnpm db:local`) or a Neon branch database - never against the production database directly.
3. Run the app's relevant tests against the migrated local schema.
4. Write the exact production migration step (command, env var needed, order of operations) to MANUAL.md under a clear heading. Do not run it yourself.
5. Commit the migration files and schema changes together with the code that depends on them.
