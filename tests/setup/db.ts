/**
 * Integration-test database helpers (docs/10 §3 "Reset").
 * The URL comes from tests/setup/global-db.ts (env DATABASE_URL_TEST or provide()).
 */
import postgres from "postgres";
import { inject } from "vitest";

export type Sql = postgres.Sql;
export type TransactionSql = postgres.TransactionSql;

let client: Sql | undefined;

export function getTestDbUrl(): string {
  const url = process.env.DATABASE_URL_TEST ?? inject("databaseUrl");
  if (!url) throw new Error("No test database: is the integration globalSetup configured?");
  return url;
}

/** Shared `postgres` client for the current worker (integration files run serially). */
export function getTestDb(): Sql {
  client ??= postgres(getTestDbUrl(), {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return client;
}

export async function closeTestDb(): Promise<void> {
  if (!client) return;
  const c = client;
  client = undefined;
  await c.end({ timeout: 5 });
}

/** Tables never truncated: migration bookkeeping (drizzle keeps its own schema, kept for safety). */
const PROTECTED_TABLES = /^(__drizzle_migrations|schema_migrations|migrations)$/;

/** TRUNCATE every table in `public` (except migration tables), restarting identities. */
export async function truncateAll(sql: Sql = getTestDb()): Promise<string[]> {
  const rows = await sql<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' order by tablename
  `;
  const tables = rows.map((r) => r.tablename).filter((t) => !PROTECTED_TABLES.test(t));
  if (tables.length === 0) return [];
  await sql.unsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"public"."${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
  return tables;
}

class RollbackSignal {
  constructor(public readonly value: unknown) {}
}

/**
 * Run `fn` inside a transaction that is always rolled back, so each test starts clean
 * without truncating. Errors thrown by `fn` propagate after the rollback.
 */
export async function withRollback<T>(
  fn: (tx: TransactionSql) => Promise<T>,
  sql: Sql = getTestDb(),
): Promise<T> {
  try {
    await sql.begin(async (tx) => {
      const value = await fn(tx);
      throw new RollbackSignal(value);
    });
  } catch (err) {
    if (err instanceof RollbackSignal) return err.value as T;
    throw err;
  }
  throw new Error("unreachable: transaction committed");
}
