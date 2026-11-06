/**
 * D17-08: the reset against real-shaped data. Every FK to users is filled with a customer as the
 * referenced row, then each single category and all categories run; none may abort, and tables
 * outside the ticked categories must be left intact. Also pins the NOT IN / NULL trap.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateTestDb } from "../../setup/migrate";
import { getTestDb, closeTestDb, truncateAll, type TransactionSql } from "../../setup/db";
import {
  KEPT_USER_REFS,
  RESET_CATEGORIES,
  stepsFor,
  type ResetCategory,
} from "@/modules/settings/site-reset-plan";
import { runReset } from "@/modules/settings/site-reset";

const sql = getTestDb();
beforeAll(async () => {
  await migrateTestDb();
});
afterAll(closeTestDb);

type Col = { column_name: string; data_type: string; udt_name: string };
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** One row per table that has an FK to users, every user column pointing at `customer`. */
async function seedUserRefs(
  tx: TransactionSql,
  customer: string,
  skip: Set<string>,
): Promise<void> {
  await tx.unsafe("SET LOCAL session_replication_role = replica"); // only non-user FKs dangle
  const fks = await tx<{ child: string; col: string }[]>`
    select c.conrelid::regclass::text child, a.attname col from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.confrelid = 'users'::regclass`;
  const byTable = new Map<string, Set<string>>();
  for (const f of fks) {
    if (f.child === "user_roles" || skip.has(f.child)) continue; // roles are seeded explicitly
    byTable.set(f.child, (byTable.get(f.child) ?? new Set()).add(f.col));
  }
  for (const [table, userCols] of byTable) {
    const cols = await tx<Col[]>`
      select column_name, data_type, udt_name from information_schema.columns
      where table_schema = 'public' and table_name = ${table} and is_generated = 'NEVER'
        and (is_nullable = 'NO' and column_default is null and identity_generation is null
             or column_name = any(${[...userCols]}))`;
    const vals: string[] = [];
    for (const c of cols) {
      if (userCols.has(c.column_name)) vals.push(lit(customer));
      else if (c.data_type === "uuid") vals.push("gen_random_uuid()");
      else if (c.data_type === "USER-DEFINED" && c.udt_name !== "citext") {
        const [e] =
          await tx`select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = ${c.udt_name} order by enumsortorder limit 1`;
        vals.push(lit(String(e!.enumlabel)));
      } else if (["integer", "bigint", "smallint", "numeric"].includes(c.data_type)) vals.push("1");
      else if (c.data_type === "boolean") vals.push("false");
      else if (c.data_type === "jsonb" || c.data_type === "json") vals.push("'{}'");
      else if (c.data_type.startsWith("timestamp")) vals.push("now()");
      else if (c.data_type === "date") vals.push("current_date");
      else if (c.data_type === "ARRAY") vals.push("'{}'");
      else if (c.data_type === "character") vals.push("'IN'");
      else vals.push(lit(c.column_name === "currency" ? "INR" : `${table}-${c.column_name}`));
    }
    await tx.unsafe(
      `insert into "${table}" (${cols.map((c) => `"${c.column_name}"`).join(",")}) values (${vals.join(",")})`,
    );
  }
}

const counts = async (tx: TransactionSql): Promise<Map<string, number>> => {
  const tables = await tx<{ t: string }[]>`
    select tablename t from pg_tables where schemaname = 'public' and tablename not like '\_\_drizzle%'`;
  const out = new Map<string, number>();
  for (const { t } of tables) {
    out.set(t, Number((await tx.unsafe(`select count(*)::int c from "${t}"`))[0]!.c));
  }
  return out;
};

const ROLLBACK = new Error("rollback");

/** Seeds (committed, FKs off so unrelated parents may dangle), then resets in a tx that is rolled back. */
async function scenario(
  cats: ResetCategory[],
  protectedCustomer = false,
  extra?: (tx: TransactionSql) => Promise<void>,
) {
  await truncateAll();
  let adm = "";
  await sql.begin(async (tx) => {
    const [a] =
      await tx`insert into users (email,name,email_verified) values ('a@x.test','A',true) returning id`;
    const [c] =
      await tx`insert into users (email,name,email_verified) values ('c@x.test','C',true) returning id`;
    adm = String(a!.id);
    await tx`insert into user_roles (user_id, role_key) values (${a!.id}, 'super_admin')`;
    // protected: also referenced by partners/approvals/legal versions, so it must be kept whole.
    const skip = new Set(protectedCustomer ? [] : KEPT_USER_REFS.map(([t]) => t));
    await seedUserRefs(tx, String(c!.id), skip);
    await extra?.(tx);
  });
  await sql
    .begin(async (tx) => {
      const before = await counts(tx);
      expect(before.get("audit_logs"), "audit_logs seeded").toBeGreaterThan(0);
      expect(before.get("orders"), "orders seeded").toBeGreaterThan(0);
      await runReset(
        { run: async (t) => [...(await tx.unsafe(t))] as Record<string, unknown>[] },
        cats,
      );
      const after = await counts(tx);
      const touched = new Set([...stepsFor(cats).map((s) => s.table), "users", "audit_logs"]);
      for (const [t, n] of before) {
        if (!touched.has(t)) expect(after.get(t), `${t} must be intact`).toBe(n);
      }
      for (const st of stepsFor(cats)) {
        if (!st.customersOnly && !st.where && before.get(st.table)) {
          expect(after.get(st.table), `${st.table} must be wiped`).toBe(0);
        }
      }
      expect(after.get("audit_logs")).toBe(before.get("audit_logs"));
      if (cats.includes("customers_orders")) {
        expect((await tx`select id from users where id = ${adm}`).length).toBe(1);
        expect(after.get("users")).toBe(protectedCustomer ? 2 : 1);
      }
      throw ROLLBACK;
    })
    .catch((e) => {
      if (e !== ROLLBACK) throw e;
    });
}

describe("site reset on real-shaped data", () => {
  for (const c of RESET_CATEGORIES) {
    it(`completes for category ${c} alone`, async () => {
      await scenario([c]);
      await scenario([c], true);
    });
  }
  it("completes for all categories", async () => {
    await scenario([...RESET_CATEGORIES]);
    await scenario([...RESET_CATEGORIES], true);
  });

  it("a NULL in a column the user filter reads does not stop customers being removed", async () => {
    await scenario([...RESET_CATEGORIES], false, async (tx) => {
      for (const [t, c] of KEPT_USER_REFS) {
        await tx.unsafe(`alter table "${t}" alter column "${c}" drop not null`);
      }
      await tx.unsafe(`insert into partners (user_id, display_name) values (null, 'ghost')`);
      await tx.unsafe(
        `insert into approval_requests (type, subject_type, subject_id, payload, requested_by) values ('product.publish','product',gen_random_uuid(),'{}',null)`,
      );
      await tx.unsafe(
        `insert into approval_decisions (request_id, decided_by, decision) select id, null, 'approve' from approval_requests where requested_by is null limit 1`,
      );
    });
  });
});
