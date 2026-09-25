/** Drops the public schema and re-applies migrations + seed. Local/preview only. */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { execSync } from "node:child_process";
import postgres from "postgres";

async function main() {
  if ((process.env.APP_ENV ?? "local") === "production")
    throw new Error("db:reset is not allowed in production");
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url, { max: 1 });
  await sql.unsafe(
    "DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pgcrypto;",
  );
  await sql.end();
  execSync("pnpm db:migrate", { stdio: "inherit" });
  execSync("pnpm db:seed", { stdio: "inherit" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
