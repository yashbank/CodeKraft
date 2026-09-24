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
