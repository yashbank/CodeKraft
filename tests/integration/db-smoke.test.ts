/**
 * Harness smoke test: the integration project gets a real Postgres with citext + pgcrypto.
 * P2 replaces the placeholder checks with migration-backed tests (runs migration 0000, rolls back).
 */
import { describe, expect, it } from "vitest";
import { getTestDb, truncateAll, withRollback } from "../setup/db";

describe("integration database", () => {
  const sql = getTestDb();

  it("connects and runs select 1", async () => {
    const [row] = await sql<{ one: number }[]>`select 1 as one`;
    expect(row?.one).toBe(1);
  });

  it("has the citext and pgcrypto extensions", async () => {
    const rows = await sql<{ extname: string }[]>`
      select extname from pg_extension where extname in ('citext', 'pgcrypto') order by extname
    `;
    expect(rows.map((r) => r.extname)).toEqual(["citext", "pgcrypto"]);
    const [ci] = await sql<{ eq: boolean }[]>`select 'Foo'::citext = 'foo'::citext as eq`;
    expect(ci?.eq).toBe(true);
  });

  it("now() works and is close to the test clock", async () => {
    const [row] = await sql<{ now: Date }[]>`select now() as now`;
    const now = row?.now;
    expect(now).toBeInstanceOf(Date);
    expect(Math.abs((now?.getTime() ?? 0) - Date.now())).toBeLessThan(60_000);
  });

  it("withRollback discards writes and returns the callback value", async () => {
    await sql.unsafe("create table if not exists harness_probe (id serial primary key, v text)");
    const inserted = await withRollback(async (tx) => {
      await tx`insert into harness_probe (v) values ('x')`;
      const [c] = await tx<{ n: string }[]>`select count(*)::text as n from harness_probe`;
      return Number(c?.n);
    });
    expect(inserted).toBe(1);
    const [after] = await sql<{ n: string }[]>`select count(*)::text as n from harness_probe`;
    expect(Number(after?.n)).toBe(0);
  });

  it("truncateAll clears public tables", async () => {
    await sql.unsafe("create table if not exists harness_probe (id serial primary key, v text)");
    await sql`insert into harness_probe (v) values ('keep?')`;
    const truncated = await truncateAll();
    expect(truncated).toContain("harness_probe");
    const [after] = await sql<{ n: string }[]>`select count(*)::text as n from harness_probe`;
    expect(Number(after?.n)).toBe(0);
    await sql.unsafe("drop table harness_probe");
  });
});
