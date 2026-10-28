/* global process, console, URL */
/**
 * One-shot demo/test data wipe. Keeps ONLY the 2 super admin users (+ their
 * accounts, roles, 2FA, profile, layout, sessions) and reference/config tables.
 *
 * Usage (reads DATABASE_URL_UNPOOLED, else DATABASE_URL, from the environment):
 *   DATABASE_URL_UNPOOLED=... node scripts/wipe-demo-data.mjs                 # dry-run (default)
 *   DATABASE_URL_UNPOOLED=... node scripts/wipe-demo-data.mjs --dry-run
 *   DATABASE_URL_UNPOOLED=... node scripts/wipe-demo-data.mjs --apply --confirm-host=<first host label>
 *
 * --apply needs --confirm-host=<ep-xxxx label printed by the dry-run> so you
 * cannot wipe the wrong database by accident. Never prints the URL or row data.
 * Aborts (exit 1, nothing changed) unless exactly 2 super_admin users exist.
 * Single transaction: any error rolls everything back.
 */
import postgres from "postgres";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply") && !args.includes("--dry-run");
const confirmHost = (args.find((a) => a.startsWith("--confirm-host=")) ?? "").split("=")[1];

// Kept untouched: migrations, RBAC reference, settings/flags, reference data, legal pages, AI prompts, numbering counters.
const KEEP = new Set([
  "__drizzle_migrations",
  "roles",
  "permissions",
  "role_permissions",
  "site_settings", // holds feature_flags + payment/bank/site config
  "fx_rates",
  "legal_pages",
  "legal_page_versions",
  "landing_chapters",
  "prompt_versions",
  "invoice_sequences",
  "credit_note_sequences",
]);
// Rows kept only for the super admins.
const BY_USER = {
  accounts: "user_id",
  sessions: "user_id",
  two_factor: "user_id",
  customer_profiles: "user_id",
  dashboard_layouts: "user_id",
  user_roles: "user_id",
  users: "id",
};
// Delete order for BY_USER tables (users last).
const BY_USER_ORDER = [
  "sessions",
  "two_factor",
  "dashboard_layouts",
  "customer_profiles",
  "accounts",
  "user_roles",
  "users",
];
// Keep-table columns that point at users with NOT NULL / no cascade: repoint to first admin.
const REPOINT = [
  ["user_roles", "granted_by"],
  ["legal_page_versions", "published_by"],
];

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED / DATABASE_URL not set");
  process.exit(1);
}
const hostLabel = new URL(url).hostname.split(".")[0].replace(/-pooler$/, "");
const q = (n) => `"${n.replace(/"/g, '""')}"`;
const mask = (e) => {
  const [l, d = ""] = String(e).split("@");
  return `${l[0] ?? ""}***@${d[0] ?? ""}***`;
};

const sql = postgres(url, { max: 1, onnotice: () => {} });
let code = 0;
try {
  console.log(`target host label: ${hostLabel}  mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  if (APPLY && confirmHost !== hostLabel)
    throw new Error(`--apply requires --confirm-host=${hostLabel}`);

  const admins =
    await sql`select u.id, u.email from users u where u.id in (select user_id from user_roles where role_key = 'super_admin') order by u.created_at`;
  console.log(`super admins found: ${admins.length}`);
  if (admins.length !== 2)
    throw new Error(
      `expected exactly 2 super admins, found ${admins.length}; aborting, nothing changed`,
    );
  for (const a of admins) console.log(`  keep: ${mask(a.email)}`);
  const ids = admins.map((a) => a.id);

  const tables = (
    await sql`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`
  ).map((r) => r.table_name);
  const wipe = tables.filter((t) => !KEEP.has(t) && !(t in BY_USER));
  const count = async (t, where = sql``) =>
    Number((await sql`select count(*)::int c from ${sql(t)} ${where}`)[0].c);
  const snapshot = async () => {
    const o = {};
    for (const t of tables) o[t] = await count(t);
    return o;
  };
  const before = await snapshot();

  // Guard: TRUNCATE ... CASCADE must not reach any protected table.
  const fks =
    await sql`select conrelid::regclass::text child, confrelid::regclass::text parent from pg_constraint where contype='f'`;
  const reach = new Set(wipe);
  for (let grew = true; grew;) {
    grew = false;
    for (const f of fks)
      if (reach.has(f.parent) && !reach.has(f.child)) {
        reach.add(f.child);
        grew = true;
      }
  }
  const leaked = [...reach].filter((t) => !wipe.includes(t));
  if (leaked.length)
    throw new Error(`CASCADE would reach protected tables: ${leaked.join(",")}; aborting`);

  console.log(
    `\nKEEP (${[...KEEP].filter((t) => tables.includes(t)).length}): ${[...KEEP].join(", ")}`,
  );
  console.log(`BY-USER (keep admins only): ${Object.keys(BY_USER).join(", ")}`);
  console.log(`WIPE (${wipe.length}): ${wipe.join(", ")}\n`);

  console.log("table | would-delete");
  for (const t of wipe) console.log(`${t} | ${before[t]}`);
  for (const t of BY_USER_ORDER) {
    const n = await count(t, sql`where ${sql(BY_USER[t])} <> all(${ids})`);
    console.log(`${t} (non-admin) | ${n}`);
  }

  if (!APPLY) {
    console.log("\ndry-run: nothing changed. Re-run with --apply --confirm-host=" + hostLabel);
  } else {
    await sql.begin(async (tx) => {
      // Append-only / no-truncate guard triggers must be off for the wipe; re-enabled in the same tx.
      for (const t of wipe) await tx.unsafe(`ALTER TABLE ${q(t)} DISABLE TRIGGER USER`);
      if (wipe.length)
        await tx.unsafe(`TRUNCATE ${wipe.map(q).join(", ")} RESTART IDENTITY CASCADE`);
      for (const t of wipe) await tx.unsafe(`ALTER TABLE ${q(t)} ENABLE TRIGGER USER`);
      for (const [t, c] of REPOINT)
        if (tables.includes(t))
          await tx.unsafe(
            `UPDATE ${q(t)} SET ${q(c)} = $1 WHERE ${q(c)} IS NOT NULL AND ${q(c)} <> ALL($2::uuid[])`,
            [ids[0], ids],
          );
      for (const t of BY_USER_ORDER)
        if (tables.includes(t))
          await tx.unsafe(`DELETE FROM ${q(t)} WHERE ${q(BY_USER[t])} <> ALL($1::uuid[])`, [ids]);
      const [{ n }] =
        await tx`select count(*)::int n from users where id in (select user_id from user_roles where role_key='super_admin')`;
      const [{ m }] = await tx`select count(*)::int m from users`;
      if (n !== 2 || m !== 2)
        throw new Error(`post-check failed (admins=${n}, users=${m}); rolled back`);
    });
    const after = await snapshot();
    console.log("\ntable | before | after");
    for (const t of tables) console.log(`${t} | ${before[t]} | ${after[t]}`);
    console.log("\nAPPLIED. 2 super admins remain.");
  }
} catch (e) {
  console.error("ERROR:", String(e.message ?? e).replace(/postgres(ql)?:\/\/\S+/g, "[redacted]"));
  code = 1;
} finally {
  await sql.end({ timeout: 5 });
  process.exit(code);
}
