/**
 * Embedded Postgres 17 for machines without Docker (docs/12 §3 fallback, shared with
 * scripts/db-local.ts). Starts a throw-away cluster on a free port in a temp directory.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readdirSync, symlinkSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";

/**
 * The darwin binaries ship dylibs as lib<name>.<major>.<minor>.dylib but link against
 * lib<name>.<major>.dylib; the package postinstall creates the symlinks. If build scripts
 * were skipped (pnpm allowBuilds), create them here so the cluster can start on any Mac.
 */
export function healDylibSymlinks(): void {
  if (process.platform !== "darwin") return;
  const pkg =
    process.arch === "arm64" ? "@embedded-postgres/darwin-arm64" : "@embedded-postgres/darwin-x64";
  let libDir: string;
  try {
    // Resolve through embedded-postgres itself: the binary package is its dependency and is
    // not hoisted by pnpm; both packages export only their main entry (no ./package.json).
    const fromHere = createRequire(import.meta.url);
    const fromEmbedded = createRequire(fromHere.resolve("embedded-postgres"));
    const main = fromEmbedded.resolve(pkg); // <pkg>/dist/index.js
    libDir = path.join(path.dirname(main), "..", "native", "lib");
  } catch {
    return;
  }
  if (!existsSync(libDir)) return;
  for (const f of readdirSync(libDir)) {
    const m = /^(lib[A-Za-z0-9_+-]+)\.(\d+)\.(\d+)(?:\.\d+)?\.dylib$/.exec(f);
    if (!m) continue;
    const short = `${m[1]}.${m[2]}.dylib`;
    const target = path.join(libDir, short);
    if (!existsSync(target)) symlinkSync(f, target);
  }
}

export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      if (!address || typeof address === "string") {
        srv.close();
        reject(new Error("could not allocate a free port"));
        return;
      }
      const { port } = address;
      srv.close(() => resolve(port));
    });
  });
}

export interface EmbeddedPg {
  url: string;
  port: number;
  dataDir: string;
  stop: () => Promise<void>;
}

export interface EmbeddedPgOptions {
  user?: string;
  password?: string;
  database?: string;
  port?: number;
  /** Temp dir prefix; the directory is removed on stop(). */
  prefix?: string;
  /** Forward postgres/initdb logs (default: only when DEBUG_PG is set). */
  verbose?: boolean;
}

/**
 * Start a fresh embedded cluster (initdb + start), create `database` and return its URL.
 * fsync is disabled: the data is disposable, and it makes initdb and truncates several
 * times faster.
 */
export async function startEmbeddedPostgres(opts: EmbeddedPgOptions = {}): Promise<EmbeddedPg> {
  const user = opts.user ?? "codekraft";
  const password = opts.password ?? "codekraft";
  const database = opts.database ?? "codekraft_test";
  const port = opts.port ?? (await getFreePort());
  const verbose = opts.verbose ?? Boolean(process.env.DEBUG_PG);
  const dataDir = await mkdtemp(path.join(os.tmpdir(), opts.prefix ?? "codekraft-pg-"));

  healDylibSymlinks();
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user,
    password,
    port,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: [
      "-c",
      "fsync=off",
      "-c",
      "synchronous_commit=off",
      "-c",
      "full_page_writes=off",
      "-c",
      "listen_addresses=127.0.0.1",
    ],
    onLog: verbose ? (m) => console.log(`[embedded-pg] ${m}`) : () => {},
    onError: verbose ? (m) => console.error(`[embedded-pg] ${String(m)}`) : () => {},
  });

  const cleanup = () => rmSync(dataDir, { recursive: true, force: true });
  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase(database);
  } catch (err) {
    try {
      await pg.stop();
    } catch {
      /* not started */
    }
    cleanup();
    throw err;
  }

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    await pg.stop();
    cleanup();
  };
  return {
    url: `postgres://${user}:${password}@127.0.0.1:${port}/${database}`,
    port,
    dataDir,
    stop,
  };
}
