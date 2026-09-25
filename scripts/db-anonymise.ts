/**
 * `pnpm db:anonymise` — replace customer PII in a non-production database (docs/12 §5.1: staging is
 * reset weekly from a production snapshot, then anonymised). Refuses when APP_ENV=production.
 * The logic lives in scripts/seed/anonymise.ts (`runAnonymise`, also used by the integration test).
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

async function main(): Promise<void> {
  if ((process.env.APP_ENV ?? "local") === "production")
    throw new Error("db:anonymise is not allowed in production");
  const [{ getDb, closeDb }, { runAnonymise }] = await Promise.all([
    import("../src/lib/db"),
    import("./seed/anonymise"),
  ]);
  const summary = await runAnonymise({ db: getDb(), log: (m) => console.log(`[anonymise] ${m}`) });
  console.table(summary);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
