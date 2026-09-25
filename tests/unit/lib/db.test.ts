// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * No real database in the unit project: `postgres` and the drizzle driver are mocked so the
 * pooled-client wiring (max 10, prepare: false), the globalThis cache and `withTx` nesting can
 * be asserted without a connection.
 */
const postgresMock = vi.hoisted(() => {
  const end = vi.fn(() => Promise.resolve());
  const factory = vi.fn((url: string, options: Record<string, unknown>) => ({ url, options, end }));
  return { factory, end };
});

const drizzleMock = vi.hoisted(() =>
  vi.fn((config: { client: unknown }) => {
    const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { kind: "tx", client: config.client };
      return fn(tx);
    });
    return { $client: config.client, transaction, marker: Symbol("db") };
  }),
);

vi.mock("postgres", () => ({ default: postgresMock.factory }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: drizzleMock }));

import {
  closeDb,
  createMigrationClient,
  db,
  getDb,
  withTx,
  type TxCtx,
  type TxRunner,
} from "@/lib/db";
import { resetEnvCache } from "@/lib/env";

const BASE_ENV = {
  APP_ENV: "local",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_ADMIN_URL: "http://admin.localhost:3000",
  ADMIN_HOST: "admin.localhost:3000",
  DATABASE_URL: "postgres://codekraft:codekraft@localhost:5432/codekraft",
  DATABASE_URL_UNPOOLED: "postgres://codekraft:codekraft@localhost:5433/codekraft",
  EMAIL_FROM: "CodeKraft <hello@localhost>",
  R2_BUCKET_PUBLIC: "codekraft-dev-public",
  R2_BUCKET_PRIVATE: "codekraft-dev-private",
  R2_BUCKET_DOCUMENTS: "codekraft-dev-documents",
  R2_BUCKET_BACKUPS: "codekraft-dev-backups",
};

describe("db client", () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    process.env = { ...BASE_ENV, NODE_ENV: "test" };
    resetEnvCache();
    postgresMock.factory.mockClear();
    postgresMock.end.mockClear();
    drizzleMock.mockClear();
  });
  afterEach(async () => {
    await closeDb();
    process.env = { ...savedEnv };
    resetEnvCache();
  });

  it("creates the pooled client lazily with max 10 and prepare: false", () => {
    expect(postgresMock.factory).not.toHaveBeenCalled();
    const first = getDb();
    expect(postgresMock.factory).toHaveBeenCalledTimes(1);
    expect(postgresMock.factory).toHaveBeenCalledWith(
      BASE_ENV.DATABASE_URL,
      expect.objectContaining({ max: 10, prepare: false }),
    );
    expect(getDb()).toBe(first);
    expect(postgresMock.factory).toHaveBeenCalledTimes(1);
  });

  it("the `db` proxy resolves to the same lazily created instance", () => {
    expect(postgresMock.factory).not.toHaveBeenCalled();
    expect(db.$client).toBe(getDb().$client);
    expect("transaction" in db).toBe(true);
    expect(postgresMock.factory).toHaveBeenCalledTimes(1);
  });

  it("caches on globalThis outside production and survives a module-level reset", async () => {
    const first = getDb();
    const g = globalThis as { __codekraftDb?: unknown };
    expect(g.__codekraftDb).toBe(first);
    await closeDb();
    expect(g.__codekraftDb).toBeUndefined();
    expect(postgresMock.end).toHaveBeenCalledTimes(1);
    expect(getDb()).not.toBe(first);
  });

  it("does not use the globalThis cache in production", () => {
    process.env = {
      ...BASE_ENV,
      APP_ENV: "production",
      NODE_ENV: "test",
      DATABASE_URL: "postgres://u:p@ep-x-pooler.aws.neon.tech/db",
      DATABASE_URL_UNPOOLED: "postgres://u:p@ep-x.aws.neon.tech/db",
      BETTER_AUTH_SECRET: "s".repeat(32),
      APP_ENCRYPTION_KEY: "k",
      CRON_SECRET: "c",
      RESEND_API_KEY: "r",
      EMAIL_TRANSPORT: "resend",
      R2_BUCKET_PUBLIC: "codekraft-public",
      R2_BUCKET_PRIVATE: "codekraft-private",
      R2_BUCKET_DOCUMENTS: "codekraft-documents",
      R2_BUCKET_BACKUPS: "codekraft-backups",
    };
    resetEnvCache();
    getDb();
    expect((globalThis as { __codekraftDb?: unknown }).__codekraftDb).toBeUndefined();
  });

  it("closeDb is a no-op when nothing was opened", async () => {
    await closeDb();
    expect(postgresMock.end).not.toHaveBeenCalled();
  });

  it("createMigrationClient uses the unpooled URL with a single connection", () => {
    createMigrationClient();
    expect(postgresMock.factory).toHaveBeenCalledWith(
      BASE_ENV.DATABASE_URL_UNPOOLED,
      expect.objectContaining({ max: 1, prepare: false }),
    );
  });
});

describe("withTx", () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    process.env = { ...BASE_ENV, NODE_ENV: "test" };
    resetEnvCache();
    postgresMock.factory.mockClear();
  });
  afterEach(async () => {
    await closeDb();
    process.env = { ...savedEnv };
    resetEnvCache();
  });

  it("opens a transaction on the pooled client when no outer transaction is given", async () => {
    const result = await withTx(async (tx) => {
      expect((tx as unknown as { kind: string }).kind).toBe("tx");
      return "done";
    });
    expect(result).toBe("done");
    const root = getDb() as unknown as { transaction: ReturnType<typeof vi.fn> };
    expect(root.transaction).toHaveBeenCalledTimes(1);
  });

  it("joins the outer transaction instead of opening a new one", async () => {
    const outer = { kind: "outer" } as unknown as TxCtx;
    const seen: unknown[] = [];
    const result = await withTx(async (tx) => {
      seen.push(tx);
      return withTx(async (inner) => {
        seen.push(inner);
        return 42;
      }, tx);
    }, outer);
    expect(result).toBe(42);
    expect(seen).toEqual([outer, outer]);
    // nothing connected: the outer handle was reused all the way down
    expect(postgresMock.factory).not.toHaveBeenCalled();
  });

  it("accepts an injected runner and propagates rejections", async () => {
    const opened = vi.fn();
    const runner: TxRunner = {
      transaction: <T>(fn: (tx: TxCtx) => Promise<T>) => {
        opened();
        return fn({ kind: "fake" } as unknown as TxCtx);
      },
    };
    await expect(
      withTx(() => Promise.reject(new Error("boom")), undefined, runner),
    ).rejects.toThrow("boom");
    expect(opened).toHaveBeenCalledTimes(1);
    expect(postgresMock.factory).not.toHaveBeenCalled();
  });
});
