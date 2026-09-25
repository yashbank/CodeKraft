/** setupFiles for the `integration` project (node environment). Vitest sets NODE_ENV=test itself. */
import { afterAll } from "vitest";
import { closeTestDb } from "./db";

process.env.APP_ENV ??= "test";
process.env.EMAIL_TRANSPORT ??= "outbox";
process.env.LLM_PROVIDER ??= "fake";
process.env.TZ ??= "UTC";

afterAll(async () => {
  await closeTestDb();
});

// Load `.env.example` defaults for anything not set (mirrors `cp .env.example .env.local` in CI),
// so `lib/env` validates in integration tests without a real .env.local.
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.example", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && m[2] !== "" && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}
