import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

let done: Promise<void> | null = null;

/** Applies drizzle/migrations to the integration database once per process. */
export function migrateTestDb(
  url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "",
): Promise<void> {
  if (!done) {
    done = (async () => {
      const client = postgres(url, { max: 1 });
      try {
        await migrate(drizzle(client), { migrationsFolder: "drizzle/migrations" });
      } finally {
        await client.end();
      }
    })();
  }
  return done;
}
