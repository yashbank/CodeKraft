/**
 * Idempotent seed (docs/05 §14, docs/12 §1 / §5.2, PHASE-02 P2.10). Orchestrates scripts/seed/*:
 *
 *   1. permissions + role_permissions from src/lib/authz/permissions.ts   (all modes)
 *   2. two Super Admins via Better Auth + partners (CEO, CFO)              (all modes)
 *   3. example catalog (tests/factories/example-catalog.ts) + versions, FAQs, testimonials,
 *      blog, featured products, coupons, test users                       (full only)
 *   4. content: chapters, services, case studies, testimonials, logos, FAQs, legal pages (full only)
 *   5. site_settings (every SITE_SETTINGS_DEFAULTS key, seeded_at, launched_at = null) (all modes)
 *   6. prompt_versions v1 active                                          (full only)
 *   7. fx_rates for today from StaticFxProvider                           (full only)
 *
 * Every write is keyed by a natural key (email, slug, key, code, version): a second run inserts
 * nothing. `--production` (or APP_ENV=production) writes only steps 1, 2 and 5 and refuses to run
 * without SEED_ADMIN_PASSWORD. Seeds are data only — nothing in `src/**` imports this file (D-018).
 *
 * Env: SEED_ADMIN_EMAILS="ceo@example.com,cfo@example.com" (default two local addresses)
 *      SEED_ADMIN_PASSWORD (default a long local passphrase; REQUIRED in production)
 *      SEED_UPI_VPA, SEED_BANK_DETAILS (JSON, bankDetailsSchema) — payee placeholders otherwise
 *
 * `runSeed()` is exported for tests/integration/seed/seed.test.ts; the CLI is `pnpm db:seed`.
 */
import type { SiteSettings } from "@/modules/settings/types";
import { seedCatalog } from "./seed/catalog";
import { seedContent } from "./seed/content";
import {
  DEFAULT_ADMIN_EMAILS,
  DEFAULT_ADMIN_PASSWORD,
  seedSuperAdmins,
  seedTestUsers,
} from "./seed/identity";
import { seedPermissions } from "./seed/permissions";
import { seedFxRates, seedPromptVersion, seedSettings } from "./seed/settings";
import { type SeedDb, type SeedMode, type SeedTally, createContext } from "./seed/shared";

export type { SeedMode } from "./seed/shared";
export { runAnonymise } from "./seed/anonymise";

export interface RunSeedOptions {
  db: SeedDb;
  mode: SeedMode;
  /** Super Admin addresses in CEO, CFO order (default `DEFAULT_ADMIN_EMAILS`). */
  adminEmails?: readonly string[];
  /** Required when `mode === "production"`. */
  adminPassword?: string;
  upiVpa?: string;
  bankDetails?: SiteSettings["bankDetails"];
  log?: (message: string) => void;
}

export interface SeedSummaryRow extends SeedTally {
  table: string;
}

export interface SeedSummary {
  mode: SeedMode;
  adminEmails: string[];
  rows: SeedSummaryRow[];
  /** Sum of `created` over every table — 0 on a repeated run. */
  created: number;
}

export async function runSeed(opts: RunSeedOptions): Promise<SeedSummary> {
  const emails = [...(opts.adminEmails ?? DEFAULT_ADMIN_EMAILS)];
  if (emails.length < 2) throw new Error("the seed needs two Super Admin addresses (CEO, CFO)");
  if (opts.mode === "production" && !opts.adminPassword)
    throw new Error("SEED_ADMIN_PASSWORD is required for the production seed");
  const password = opts.adminPassword ?? DEFAULT_ADMIN_PASSWORD;
  const ctx = createContext(opts.db, opts.mode, opts.log);

  await seedPermissions(ctx);
  const admins = await seedSuperAdmins(ctx, { emails, password });
  const ceo = admins[0];
  const cfo = admins[1];
  if (ceo === undefined || cfo === undefined) throw new Error("super admins were not seeded");

  if (opts.mode === "full") {
    await seedTestUsers(ctx, password);
    await seedCatalog(ctx, { partnerEmails: { ceo: ceo.email, cfo: cfo.email } });
    await seedContent(ctx, { adminUserId: ceo.user.id });
  }

  await seedSettings(ctx, {
    adminUserId: ceo.user.id,
    upiVpa: opts.upiVpa,
    bankDetails: opts.bankDetails,
  });

  if (opts.mode === "full") {
    await seedPromptVersion(ctx, ceo.user.id);
    await seedFxRates(ctx);
  }

  const rows = [...ctx.tallies.entries()].map(([table, t]) => ({ table, ...t }));
  return {
    mode: opts.mode,
    adminEmails: emails,
    rows,
    created: rows.reduce((sum, r) => sum + r.created, 0),
  };
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

function parseBankDetails(raw: string | undefined): SiteSettings["bankDetails"] | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  return JSON.parse(raw) as SiteSettings["bankDetails"];
}

async function main(): Promise<void> {
  const { config: loadEnv } = await import("dotenv");
  loadEnv({ path: ".env.local" });
  loadEnv({ path: ".env" });

  const [{ getEnv }, { getDb, closeDb }] = await Promise.all([
    import("../src/lib/env"),
    import("../src/lib/db"),
  ]);
  const env = getEnv();
  const flagProduction = process.argv.includes("--production");
  const mode: SeedMode = flagProduction || env.APP_ENV === "production" ? "production" : "full";
  const adminEmails = (process.env.SEED_ADMIN_EMAILS ?? DEFAULT_ADMIN_EMAILS.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const started = Date.now();
  const summary = await runSeed({
    db: getDb(),
    mode,
    adminEmails,
    adminPassword: process.env.SEED_ADMIN_PASSWORD,
    upiVpa: process.env.SEED_UPI_VPA,
    bankDetails: parseBankDetails(process.env.SEED_BANK_DETAILS),
    log: (m) => console.log(`[seed] ${m}`),
  });
  console.log(`\n[seed] mode=${summary.mode} admins=${summary.adminEmails.join(", ")}`);
  console.table(
    summary.rows.map((r) => ({ table: r.table, created: r.created, updated: r.updated })),
  );
  console.log(`[seed] ${summary.created} row(s) created in ${Date.now() - started} ms`);
  await closeDb();
}

const invokedDirectly =
  typeof process.argv[1] === "string" && /(^|\/)seed\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
