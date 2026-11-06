/**
 * D17-08: every schema table is classified keep or wipe, no KEEP table loses rows through an FK
 * cascade, and a full reset on real Postgres keeps staff and restarts invoice numbering.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateTestDb } from "../../setup/migrate";
import { getTestDb, closeTestDb, truncateAll } from "../../setup/db";
import {
  KEPT_USER_REFS,
  RESET_KEEP_TABLES,
  RESET_STEPS,
  type ResetCategory,
} from "@/modules/settings/site-reset-plan";
import { runReset } from "@/modules/settings/site-reset";

const sql = getTestDb();
beforeAll(async () => {
  await migrateTestDb();
});
afterAll(closeTestDb);
const ALL: ResetCategory[] = [
  "leads",
  "quotes",
  "customers_orders",
  "products",
  "content",
  "finance",
];
// Tables with a `where` are KEEP tables with a filtered delete (approvals), not wiped tables.
const wiped = new Set(RESET_STEPS.filter((s) => !s.where).map((s) => s.table));
const kept = new Set(RESET_KEEP_TABLES);
// users/user_roles are partially wiped (customers only); admins always survive.

describe("site reset classification", () => {
  it("classifies every schema table as keep or wipe, exactly once", async () => {
    const rows = await sql<{ t: string }[]>`
      select tablename t from pg_tables where schemaname='public' and tablename not like '\_\_drizzle%'`;
    const all = rows.map((r) => r.t);
    expect(all.filter((t) => !wiped.has(t) && !kept.has(t))).toEqual([]);
    expect(all.filter((t) => wiped.has(t) && kept.has(t))).toEqual([]);
    expect(RESET_STEPS.filter((s) => s.where && !kept.has(s.table))).toEqual([]);
    expect([...wiped, ...kept].filter((t) => !all.includes(t))).toEqual([]);
  });

  it("no KEEP table has a cascading or blocking FK to a wiped table the plan does not handle", async () => {
    const fks = await sql<{ child: string; col: string; parent: string; rule: string }[]>`
      select c.conrelid::regclass::text child, a.attname col, c.confrelid::regclass::text parent,
             c.confdeltype rule
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.contype='f' and c.connamespace='public'::regnamespace`;
    // Handled: KEPT_USER_REFS users are kept whole; coupons.created_by is nulled in the users step.
    const handled = new Set([...KEPT_USER_REFS.map(([t, c]) => `${t}.${c}`), "coupons.created_by"]);
    const bad = fks.filter(
      (f) =>
        kept.has(f.child) &&
        wiped.has(f.parent) &&
        ["c", "a", "r"].includes(f.rule) &&
        !(f.parent === "users" && f.rule !== "c" && handled.has(`${f.child}.${f.col}`)),
    );
    expect(bad).toEqual([]);
  });

  it("wipes customers and their data, keeps staff, restarts invoice numbering", async () => {
    await truncateAll();
    const [adm] =
      await sql`insert into users (email,name,email_verified) values ('a@x.test','A',true) returning id`;
    const [cus] =
      await sql`insert into users (email,name,email_verified) values ('c@x.test','C',true) returning id`;
    await sql`insert into user_roles (user_id, role_key) values (${adm!.id}, 'super_admin')`;
    const [par] =
      await sql`insert into users (email,name,email_verified) values ('p@x.test','P',true) returning id`;
    await sql`insert into partners (user_id, display_name) values (${par!.id}, 'Partner')`;
    const [cpn] =
      await sql`insert into coupons (code, kind, value, redemptions_count, created_by) values ('C1', 'percent', 1000, 5, ${cus!.id}) returning id`;
    await sql`insert into approval_requests (type, subject_type, subject_id, payload, requested_by) values ('refund.issue', 'order', gen_random_uuid(), '{}'::jsonb, ${cus!.id})`;
    await sql`insert into approval_requests (type, subject_type, subject_id, payload, requested_by) values ('site.reset', 'site', gen_random_uuid(), '{}'::jsonb, ${adm!.id}), ('product.publish', 'product', gen_random_uuid(), '{}'::jsonb, ${adm!.id})`;
    await sql`insert into invoice_sequences (fy, last_seq) values ('2026-27', 41)`;
    await sql`insert into notifications (user_id, type, title) values (${cus!.id}, 'x', 'hi')`;
    await sql`insert into analytics_events (name, user_id) values ('pv', ${cus!.id})`;
    await sql`insert into site_settings (key, value) values ('brand', '{}'::jsonb) on conflict do nothing`;
    const settingsBefore = Number((await sql`select count(*)::int c from site_settings`)[0]!.c);
    await sql.begin(async (tx) => {
      await runReset(
        { run: async (t) => [...(await tx.unsafe(t))] as Record<string, unknown>[] },
        ALL,
      );
    });
    const n = async (t: string) =>
      Number((await sql.unsafe(`select count(*)::int c from ${t}`))[0]!.c);
    expect(await n("users")).toBe(1); // admin only; the ex-partner without finance rows goes too
    expect(await n("partners")).toBe(0);
    expect(await n("approval_requests")).toBe(2); // site.reset + product.publish survive, refund.issue gone
    expect(await n("coupons")).toBe(1);
    expect(
      (await sql`select redemptions_count c, created_by from coupons where id=${cpn!.id}`)[0],
    ).toMatchObject({ c: 0 });
    expect(await n("invoice_sequences")).toBe(0);
    expect(await n("analytics_events")).toBe(0);
    expect(await n("notifications")).toBe(0);
    expect(await n("site_settings")).toBe(settingsBefore);
    expect(await n("user_roles")).toBe(1);
  });
});
