/**
 * Production demo-data wipe (audit/round-4, PHASE 2).
 *
 * Keeps: the two super admins (KEEP_EMAILS), roles/permissions/role_permissions, site_settings,
 * fx_rates, landing_chapters, legal_pages/legal_page_versions, categories/tags, audit_logs
 * (never touched), the site-level Arjun Bhaskar testimonial, migrations.
 * Deletes everything else listed in the brief (customers/staff/partners, orders/payments/
 * quotes/leads/queries/chat, entitlements/delivery, finance, approvals/ownership, products and
 * dependents, services/case studies, demo FAQs).
 *
 * Default is DRY RUN: selects what would be deleted, writes a full-row JSON snapshot to
 * scratch/wipe-demo-data-snapshot-<ts>.json, prints per-table matched counts. Nothing is deleted.
 * --apply runs the real deletes, one Postgres SAVEPOINT per row (or per table for tables without
 * a single-column id PK), so a row blocked by a trigger/FK (ledger_entries, payouts, allocations,
 * invoices, credit_notes are expected to be append-only/immutable) is skipped and logged instead
 * of aborting the whole run or bypassing the protection.
 *
 * Run: tsx scripts/ops/wipe-demo-data.ts [--apply]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.production.local", override: true });
process.env.APP_ENV = "production";

import { writeFileSync, mkdirSync } from "node:fs";
import { sql } from "drizzle-orm";

const KEEP_EMAILS = ["yashbank2002@gmail.com", "sanketshrikant42@gmail.com"];
const DEMO_FAQ_PATTERNS = ["%demo%", "%test%", "%placeholder%", "%gibberish%", "%lorem%"];

interface Step {
  label: string;
  table: string;
  where: ReturnType<typeof sql>;
  /** Tables without a plain `id` uuid PK (composite key) — bulk delete only, no per-row savepoints. */
  bulkOnly?: boolean;
}

interface StepReport {
  label: string;
  table: string;
  matched: number;
  deleted: number;
  skipped: number;
  errors: { id?: string; message: string }[];
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { getDb, closeDb } = await import("../../src/lib/db");
  const db = getDb();

  const keepUsers = await db.execute<{ id: string; email: string }>(
    sql`SELECT id, email FROM users WHERE email IN (${sql.join(
      KEEP_EMAILS.map((e) => sql`${e}`),
      sql`, `,
    )})`,
  );
  if (keepUsers.length !== KEEP_EMAILS.length) {
    throw new Error(
      `expected ${KEEP_EMAILS.length} keep-users, found ${keepUsers.length}: ${JSON.stringify(keepUsers)}. Aborting, nothing touched.`,
    );
  }
  const keepUserIds = keepUsers.map((u) => u.id);
  console.log(`keep users: ${keepUsers.map((u) => u.email).join(", ")}`);

  const keepTestimonial = await db.execute<{ id: string }>(
    sql`SELECT id FROM testimonials WHERE context = 'site' AND author_name ILIKE '%Arjun Bhaskar%' LIMIT 1`,
  );
  const keepTestimonialId = keepTestimonial[0]?.id ?? null;
  console.log(
    `keep testimonial (Arjun Bhaskar, site): ${keepTestimonialId ?? "NOT FOUND - will not exempt any testimonial"}`,
  );

  const steps: Step[] = [
    { label: "chat messages", table: "chat_messages", where: sql`true` },
    { label: "chat conversations", table: "conversations", where: sql`true` },
    { label: "query messages", table: "query_messages", where: sql`true` },
    { label: "queries", table: "queries", where: sql`true` },
    { label: "lead activities", table: "lead_activities", where: sql`true` },
    { label: "leads", table: "leads", where: sql`true` },
    { label: "coupon redemptions", table: "coupon_redemptions", where: sql`true` },
    { label: "coupons", table: "coupons", where: sql`true` },
    { label: "subscriptions", table: "subscriptions", where: sql`true` },
    { label: "service progress", table: "service_progress", where: sql`true` },
    { label: "downloads", table: "downloads", where: sql`true` },
    { label: "delivery tasks", table: "delivery_tasks", where: sql`true` },
    { label: "entitlements", table: "entitlements", where: sql`true` },
    {
      label: "ownership split lines",
      table: "product_ownership_lines",
      where: sql`true`,
      bulkOnly: true,
    },
    { label: "ownership splits", table: "product_ownerships", where: sql`true` },
    { label: "approval decisions", table: "approval_decisions", where: sql`true` },
    { label: "approval requests", table: "approval_requests", where: sql`true` },
    { label: "allocations (expect PROTECT: immutable)", table: "allocations", where: sql`true` },
    { label: "credit notes (expect PROTECT: immutable)", table: "credit_notes", where: sql`true` },
    {
      label: "ledger entries (expect PROTECT: append-only)",
      table: "ledger_entries",
      where: sql`true`,
    },
    { label: "payouts (expect PROTECT: immutable)", table: "payouts", where: sql`true` },
    { label: "invoices (expect PROTECT: immutable)", table: "invoices", where: sql`true` },
    { label: "refunds", table: "refunds", where: sql`true` },
    { label: "expenses", table: "expenses", where: sql`true` },
    { label: "payments", table: "payments", where: sql`true` },
    { label: "order items", table: "order_items", where: sql`true` },
    { label: "orders", table: "orders", where: sql`true` },
    { label: "custom quotes", table: "custom_quotes", where: sql`true` },
    { label: "services", table: "services", where: sql`true` },
    { label: "case studies", table: "case_studies", where: sql`true` },
    {
      label: "testimonials (except site/Arjun Bhaskar)",
      table: "testimonials",
      where: keepTestimonialId ? sql`id <> ${keepTestimonialId}::uuid` : sql`true`,
    },
    {
      label: "demo FAQs (question/answer matches demo|test|placeholder|gibberish|lorem)",
      table: "faqs",
      where: sql`(${sql.join(
        DEMO_FAQ_PATTERNS.flatMap((p) => [
          sql`question ILIKE ${p}`,
          sql`answer_json::text ILIKE ${p}`,
        ]),
        sql` OR `,
      )})`,
    },
    {
      label: "products (cascades offerings/media/versions/blogs/faqs/testimonials/tags)",
      table: "products",
      where: sql`true`,
    },
    { label: "partners", table: "partners", where: sql`true` },
    {
      label: "users (except the 2 super admins)",
      table: "users",
      where: sql`id NOT IN (${sql.join(
        keepUserIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    },
  ];

  const snapshot: Record<string, unknown[]> = {};
  const report: StepReport[] = [];

  for (const step of steps) {
    const idRows = await db.execute<{ id: string }>(
      step.bulkOnly
        ? sql`SELECT 1 AS id FROM ${sql.raw(step.table)} WHERE ${step.where} LIMIT 1`
        : sql`SELECT id FROM ${sql.raw(step.table)} WHERE ${step.where}`,
    );
    const fullRows = await db.execute(
      sql`SELECT * FROM ${sql.raw(step.table)} WHERE ${step.where}`,
    );
    snapshot[step.table] = fullRows;

    if (fullRows.length === 0) {
      report.push({
        label: step.label,
        table: step.table,
        matched: 0,
        deleted: 0,
        skipped: 0,
        errors: [],
      });
      continue;
    }

    if (!apply) {
      report.push({
        label: step.label,
        table: step.table,
        matched: fullRows.length,
        deleted: 0,
        skipped: 0,
        errors: [],
      });
      continue;
    }

    const errors: { id?: string; message: string }[] = [];
    let deleted = 0;
    let skipped = 0;

    if (step.bulkOnly) {
      try {
        await db.transaction(async (tx) => {
          await tx.execute(sql`DELETE FROM ${sql.raw(step.table)} WHERE ${step.where}`);
        });
        deleted = fullRows.length;
      } catch (e) {
        skipped = fullRows.length;
        errors.push({ message: e instanceof Error ? e.message : String(e) });
      }
    } else {
      for (const row of idRows) {
        try {
          await db.transaction(async (tx) => {
            await tx.execute(sql`DELETE FROM ${sql.raw(step.table)} WHERE id = ${row.id}::uuid`);
          });
          deleted++;
        } catch (e) {
          skipped++;
          errors.push({ id: row.id, message: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    report.push({
      label: step.label,
      table: step.table,
      matched: fullRows.length,
      deleted,
      skipped,
      errors: errors.slice(0, 5),
    });
  }

  mkdirSync("scratch", { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotPath = `scratch/wipe-demo-data-snapshot-${ts}.json`;
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

  console.log(`\nmode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`snapshot written: ${snapshotPath}`);
  for (const r of report) {
    console.log(
      `${r.table.padEnd(26)} matched=${r.matched} deleted=${r.deleted} skipped=${r.skipped}${
        r.errors.length ? ` errors=${JSON.stringify(r.errors)}` : ""
      }`,
    );
  }

  if (apply) {
    const finalUsers = await db.execute<{ email: string }>(
      sql`SELECT email FROM users ORDER BY email`,
    );
    console.log(
      `\nusers remaining (${finalUsers.length}): ${finalUsers.map((u) => u.email).join(", ")}`,
    );
  }

  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
