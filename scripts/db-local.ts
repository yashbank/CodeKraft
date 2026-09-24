/**
 * Local Postgres without Docker (docs/12 §3 fallback). Downloads Postgres 18 binaries once
 * (embedded-postgres) and serves codekraft/codekraft@localhost:5432/codekraft with data in .pg/data.
 * Usage: pnpm db:local   (Ctrl-C stops it; data persists)
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readdirSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * The darwin binaries ship dylibs as lib<name>.<major>.<minor>.dylib but link against
 * lib<name>.<major>.dylib; the postinstall creates the symlinks. If build scripts were
 * skipped (pnpm allowBuilds), create them here so the cluster can start on any Mac.
 */
function healDylibSymlinks() {
  if (process.platform !== "darwin") return;
  const require = createRequire(import.meta.url);
  const pkg =
    process.arch === "arm64" ? "@embedded-postgres/darwin-arm64" : "@embedded-postgres/darwin-x64";
  let libDir: string;
  try {
    libDir = path.join(path.dirname(require.resolve(`${pkg}/package.json`)), "native", "lib");
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

const dataDir = path.resolve(".pg/data");
const port = Number.parseInt(process.env.PGPORT ?? "5432", 10);
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "codekraft",
  password: "codekraft",
  port,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

async function main() {
  healDylibSymlinks();
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log(`[db:local] initialising cluster at ${dataDir}`);
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase("codekraft");
  } catch {
    /* already exists */
  }
  const client = pg.getPgClient();
  await client.connect();
  await client.query(
    "CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pgcrypto;",
  );
  await client.end();
  console.log(`[db:local] ready: postgres://codekraft:codekraft@localhost:${port}/codekraft`);
  const stop = async () => {
    console.log("\n[db:local] stopping");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
