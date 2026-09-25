/**
 * Database client — docs/04 §7.1, docs/12 §5.1.
 *
 * Drizzle over `postgres` (postgres-js). The app uses the pooled Neon URL (PgBouncer transaction
 * mode: `prepare: false`, no session state, no session-level advisory locks); migrations and
 * dumps use `DATABASE_URL_UNPOOLED` with a single connection. The client is created lazily on
 * first use and cached on `globalThis` outside production so Next.js HMR does not leak pools.
 *
 * TODO(P2): import `drizzle/schema` and type the client as `PostgresJsDatabase<typeof schema>`.
 */
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { getEnv } from "./env";

if (typeof window !== "undefined") {
  throw new Error("src/lib/db.ts is server-only and must not be imported in the browser");
}

// TODO(P2): replace with `typeof schema` once drizzle/schema exists.
export type Schema = Record<string, never>;
export type Db = PostgresJsDatabase<Schema> & { $client: Sql };
/** Transaction handle passed to `withTx` callbacks (queries + nested `withTx`). */
export type TxCtx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either the root client or a transaction — the type services accept for "run here". */
export type DbOrTx = Db | TxCtx;

export const POOL_MAX = 10;

interface GlobalDbCache {
  __codekraftDb?: Db;
}

const globalCache = globalThis as typeof globalThis & GlobalDbCache;
let instance: Db | undefined;

function createClient(url: string, max: number): Db {
  const client = postgres(url, {
    max,
    prepare: false, // PgBouncer transaction mode (Neon pooler) — no named prepared statements
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => undefined,
  });
  return drizzle({ client }) as Db;
}

/** Pooled application client (lazy). */
export function getDb(): Db {
  if (instance !== undefined) return instance;
  const env = getEnv();
  if (env.APP_ENV !== "production" && globalCache.__codekraftDb !== undefined) {
    instance = globalCache.__codekraftDb;
    return instance;
  }
  instance = createClient(env.DATABASE_URL, POOL_MAX);
  if (env.APP_ENV !== "production") globalCache.__codekraftDb = instance;
  return instance;
}

/**
 * The application client. A lazy proxy: nothing connects (and env is not parsed) until the first
 * property access, so importing this module in tests or build steps is free.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    return Reflect.get(real, prop, real) as unknown;
  },
  has(_target, prop) {
    return prop in getDb();
  },
});

/** Single direct (unpooled) connection for `drizzle-kit`-style migrations and `pg_dump`. */
export function createMigrationClient(): Db {
  return createClient(getEnv().DATABASE_URL_UNPOOLED, 1);
}

/** Anything that can open a transaction (the root client, or a fake in unit tests). */
export interface TxRunner {
  transaction<T>(fn: (tx: TxCtx) => Promise<T>): Promise<T>;
}

/**
 * Run `fn` in a transaction. When `outerTx` is given the callback joins it (no savepoint, no new
 * connection) so services compose: `withTx(inner, tx)` inside another `withTx`. `runner` defaults
 * to the pooled client and exists for unit tests.
 */
export async function withTx<T>(
  fn: (tx: TxCtx) => Promise<T>,
  outerTx?: TxCtx,
  runner?: TxRunner,
): Promise<T> {
  if (outerTx !== undefined) return fn(outerTx);
  const r: TxRunner = runner ?? getDb();
  return r.transaction((tx) => fn(tx));
}

/** Close the pooled client (tests, graceful shutdown). Safe to call when nothing was opened. */
export async function closeDb(): Promise<void> {
  const current = instance ?? globalCache.__codekraftDb;
  instance = undefined;
  delete globalCache.__codekraftDb;
  if (current === undefined) return;
  await current.$client.end({ timeout: 5 });
}
