/**
 * Factory plumbing (docs/10 §3): the database handle every factory accepts, and the deterministic
 * sequence/PRNG that replaces `@faker-js/faker` (not a dependency of this repo — no new deps in P2).
 *
 * Every factory has the shape `create<X>(options?, db?)`: `db` defaults to the pooled app client
 * (`getDb()`), or is a drizzle transaction / a wrapped `postgres` transaction from `withFactories()`
 * so a test can run inside `withRollback()` from tests/setup/db.ts.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import type { Sql, TransactionSql } from "postgres";

import { type DbOrTx, getDb } from "@/lib/db";

/** Root client or transaction — anything drizzle can `insert`/`select` through. */
export type FactoryDb = DbOrTx;
/** What `withFactories()` accepts: a drizzle handle or a raw `postgres` client/transaction. */
export type FactoryDbInput = FactoryDb | Sql | TransactionSql;

function isPostgresClient(value: FactoryDbInput): value is Sql | TransactionSql {
  return typeof (value as { unsafe?: unknown }).unsafe === "function";
}

/**
 * Normalise a `postgres` client/transaction into a drizzle handle; drizzle handles pass through.
 *
 * drizzle's postgres-js driver installs transparent date/json parsers on `client.options` when it
 * is constructed. A `TransactionSql` has no `options` (they belong to the root client, and mutating
 * them would change how the harness client parses timestamps for every raw query in the file), so
 * the transaction is wrapped in a shim that exposes `unsafe()` and throw-away options. Rows then
 * come back through the root client's default parsers: `timestamptz` as `Date` (drizzle accepts
 * it), `date` columns as `Date` rather than the `YYYY-MM-DD` string drizzle's string mode returns
 * on the app client — factories that return such a column normalise it (see `dateString`).
 */
export function toFactoryDb(input?: FactoryDbInput): FactoryDb {
  if (input === undefined) return getDb();
  if (isPostgresClient(input)) {
    const shim = {
      unsafe: (query: string, params?: unknown[], options?: Record<string, unknown>) =>
        input.unsafe(query, params as never, options as never),
      options: { parsers: {}, serializers: {} },
    };
    return drizzle({ client: shim as unknown as Sql }) as unknown as FactoryDb;
  }
  return input;
}

/** `date`-column value as `YYYY-MM-DD` whichever parser produced it (see `toFactoryDb`). */
export function dateString(value: string | Date): string {
  return value instanceof Date ? isoDate(value) : value;
}

// ---------------------------------------------------------------------------------------------
// Deterministic sequence + PRNG (docs/10 §3 "seeded 1207")
// ---------------------------------------------------------------------------------------------

export const FACTORY_SEED = 1207;

let counter = 0;
let rngState = FACTORY_SEED >>> 0;

/** mulberry32 — small, fast, deterministic; plenty for fixture variety. */
function nextRandom(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Monotonic per-process counter shared by every factory (emails, slugs, codes, invoice seqs). */
export function nextSeq(): number {
  counter += 1;
  return counter;
}

/** `"product-0007"` style unique-but-deterministic labels. */
export function seqLabel(prefix: string, width = 4): string {
  return `${prefix}-${String(nextSeq()).padStart(width, "0")}`;
}

/** Deterministic integer in `[min, max]`. */
export function randomInt(min: number, max: number): number {
  return min + Math.floor(nextRandom() * (max - min + 1));
}

/** Deterministic pick from a non-empty list. */
export function pick<T>(items: readonly T[]): T {
  if (items.length === 0) throw new RangeError("pick() needs a non-empty list");
  return items[randomInt(0, items.length - 1)] as T;
}

/**
 * Reset the counter and PRNG (`faker.seed(1207)` equivalent) so a test can assert that the same
 * calls yield the same defaults. Committed rows from an earlier run keep their unique emails/slugs,
 * so reset only after `truncateAll()` or inside a rolled-back transaction.
 */
export function resetSequences(seed: number = FACTORY_SEED): void {
  counter = 0;
  rngState = seed >>> 0;
}

// ---------------------------------------------------------------------------------------------
// Small helpers shared by the factories
// ---------------------------------------------------------------------------------------------

/** `insert(...).returning()` yields an array; every factory inserts exactly one row. */
export function one<T>(rows: readonly T[], what: string): T {
  const row = rows[0];
  if (row === undefined) throw new Error(`${what}: insert returned no row`);
  return row;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/** `YYYY-MM-DD` (UTC) for `date` columns in string mode. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
