/**
 * Vitest globalSetup for the `integration` project: provides one Postgres for the whole run.
 *
 * Selection order (docs/10 §4, docs/12 §3):
 *   1. DATABASE_URL_TEST set          → use it as-is (CI `services: postgres`, compose Postgres)
 *   2. Docker reachable (`docker info`) → @testcontainers/postgresql, postgres:16-alpine
 *   3. otherwise                      → embedded Postgres 17 on a free port in a temp dir
 *
 * The URL is exported to workers as process.env.DATABASE_URL_TEST and via provide("databaseUrl").
 * Migrations (P2) will be applied here once drizzle/ exists; today only the extensions are created.
 */
import { execFileSync } from "node:child_process";
import postgres from "postgres";
import type { TestProject } from "vitest/node";
import { startEmbeddedPostgres } from "./embedded-pg";

export type DbMode = "external" | "testcontainers" | "embedded";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
    dbMode: DbMode;
  }
}

function dockerAvailable(): boolean {
  if (process.env.CODEKRAFT_TEST_DB === "embedded") return false;
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

async function ensureExtensions(url: string): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe("CREATE EXTENSION IF NOT EXISTS citext");
    await sql.unsafe("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  } finally {
    await sql.end();
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const log = (msg: string) => console.log(`[integration-db] ${msg}`);
  let url: string;
  let mode: DbMode;
  let stop: () => Promise<void> = async () => {};

  if (process.env.DATABASE_URL_TEST) {
    mode = "external";
    url = process.env.DATABASE_URL_TEST;
    log(`using DATABASE_URL_TEST (${new URL(url).host})`);
  } else if (dockerAvailable()) {
    mode = "testcontainers";
    const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
    const container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("codekraft_test")
      .withUsername("codekraft")
      .withPassword("codekraft")
      .start();
    url = container.getConnectionUri();
    stop = () => container.stop().then(() => {});
    log(`testcontainers postgres:16-alpine on ${new URL(url).host}`);
  } else {
    mode = "embedded";
    const started = Date.now();
    const pg = await startEmbeddedPostgres();
    url = pg.url;
    stop = pg.stop;
    log(`embedded Postgres 17 on 127.0.0.1:${pg.port} (${Date.now() - started} ms)`);
  }

  await ensureExtensions(url);
  process.env.DATABASE_URL_TEST = url;
  project.provide("databaseUrl", url);
  project.provide("dbMode", mode);

  return async () => {
    await stop();
  };
}
