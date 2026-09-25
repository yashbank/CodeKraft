/**
 * P2.4 migration suite: 0000 + 0001 apply on the fresh integration database (idempotent), every
 * docs/05 table and view exists, the §12 integrity triggers exist and behave (append-only, payments
 * frozen, approver ≠ requester, ownership lines sum, category depth). The full per-rule matrix with
 * the app role is P2.11 (tests/integration/triggers). Fixtures are raw SQL with explicit uuids.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

const sql = getTestDb();

/** docs/05 §1–§11 tables (auth from 0000, everything else from 0001). */
const DOC_TABLES = [
  // §1 identity & access
  "users",
  "sessions",
  "accounts",
  "verifications",
  "two_factor",
  "roles",
  "user_roles",
  "permissions",
  "role_permissions",
  "partners",
  "customer_profiles",
  // §2 catalog + media
  "media",
  "categories",
  "tags",
  "product_tags",
  "slug_redirects",
  "products",
  "product_versions",
  "product_faqs",
  "product_testimonials",
  "product_media",
  "product_blogs",
  "featured_products",
  // §3 offerings
  "offerings",
  "offering_prices",
  "offering_payment_methods",
  // §4 ownership
  "product_ownerships",
  "product_ownership_lines",
  // §5 commerce + invoices
  "coupons",
  "coupon_redemptions",
  "custom_quotes",
  "orders",
  "order_items",
  "user_offering_purchases",
  "payments",
  "refunds",
  "invoices",
  "invoice_sequences",
  "credit_notes",
  "credit_note_sequences",
  // §6 entitlements & delivery
  "entitlements",
  "subscriptions",
  "service_progress",
  "downloads",
  "delivery_tasks",
  "release_files",
  // §7 finance
  "ledger_entries",
  "allocations",
  "payouts",
  "expenses",
  "fx_rates",
  // §8 approvals & audit
  "approval_requests",
  "approval_decisions",
  "audit_logs",
  // §9 leads, queries, chat
  "leads",
  "lead_activities",
  "queries",
  "query_messages",
  "conversations",
  "chat_messages",
  "chat_usage_daily",
  "prompt_versions",
  "knowledge_chunks",
  // §10 content
  "landing_chapters",
  "services",
  "case_studies",
  "testimonials",
  "client_logos",
  "faqs",
  "legal_pages",
  "legal_page_versions",
  "site_settings",
  // §11 notifications, dashboard, analytics, ops
  "notifications",
  "email_outbox",
  "dashboard_layouts",
  "analytics_events",
  "job_runs",
  "webhook_events",
  "files_upload_intents",
  "rate_limit_buckets",
  "wishlists",
];

const TRIGGERS: Record<string, string[]> = {
  ledger_entries: ["trg_append_only", "trg_no_truncate"],
  allocations: ["trg_append_only", "trg_no_truncate"],
  payouts: ["trg_append_only", "trg_no_truncate"],
  invoices: ["trg_append_only", "trg_no_truncate"],
  credit_notes: ["trg_append_only", "trg_no_truncate"],
  audit_logs: ["trg_append_only", "trg_no_truncate"],
  payments: ["trg_payment_frozen"],
  order_items: ["trg_order_item_ownership_frozen"],
  approval_decisions: ["trg_approver_is_requester"],
  product_ownership_lines: ["trg_ownership_lines_sum"],
  categories: ["trg_category_depth"],
};

// Fixture ids (explicit so assertions can reference them).
const U_ADMIN = "00000000-0000-4000-8000-000000000001";
const U_ADMIN2 = "00000000-0000-4000-8000-000000000002";
const U_CUSTOMER = "00000000-0000-4000-8000-000000000003";
const PARTNER_A = "00000000-0000-4000-8000-000000000011";
const PARTNER_B = "00000000-0000-4000-8000-000000000012";
const PRODUCT = "00000000-0000-4000-8000-000000000021";
const ORDER = "00000000-0000-4000-8000-000000000031";
const PAYMENT = "00000000-0000-4000-8000-000000000041";
const INVOICE = "00000000-0000-4000-8000-000000000051";
const LEDGER = "00000000-0000-4000-8000-000000000061";
const AUDIT = "00000000-0000-4000-8000-000000000071";
const REQUEST = "00000000-0000-4000-8000-000000000081";
const OWN_A = "00000000-0000-4000-8000-000000000091";

const seedFixtures = async () => {
  await sql.unsafe(`
    INSERT INTO users (id, name, email) VALUES
      ('${U_ADMIN}', 'Admin One', 'admin1@example.com'),
      ('${U_ADMIN2}', 'Admin Two', 'admin2@example.com'),
      ('${U_CUSTOMER}', 'Customer', 'customer@example.com');
    INSERT INTO partners (id, user_id, display_name) VALUES
      ('${PARTNER_A}', '${U_ADMIN}', 'Partner A'),
      ('${PARTNER_B}', '${U_ADMIN2}', 'Partner B');
    INSERT INTO products (id, name, slug, created_by, updated_by)
      VALUES ('${PRODUCT}', 'Widget', 'widget', '${U_ADMIN}', '${U_ADMIN}');
    INSERT INTO orders (id, order_no, user_id, currency, subtotal_minor, total_minor, billing_snapshot, fx_rate_to_inr)
      VALUES ('${ORDER}', 'CK-ORD-000001', '${U_CUSTOMER}', 'INR', 10000, 10000,
              '{"name":"Customer","email":"customer@example.com","country":"IN"}', 1);
    INSERT INTO payments (id, order_id, provider, status, amount_due_minor, amount_received_minor, currency, confirmed_by, confirmed_at)
      VALUES ('${PAYMENT}', '${ORDER}', 'manual_upi', 'confirmed', 10000, 10500, 'INR', '${U_ADMIN}', now());
    INSERT INTO invoices (id, invoice_no, order_id, fy, seq, seller_snapshot, buyer_snapshot, lines, subtotal_minor, total_minor, currency)
      VALUES ('${INVOICE}', 'CK/2026-27/0001', '${ORDER}', '2026-27', 1,
              '{"name":"CodeKraft","address":"Pune"}', '{"name":"Customer","email":"customer@example.com","country":"IN"}',
              '[]', 10000, 10000, 'INR');
    INSERT INTO ledger_entries (id, entry_type, order_id, party_type, partner_id, amount_minor, currency, fx_rate_to_inr, amount_inr_minor, created_by)
      VALUES ('${LEDGER}', 'partner_allocation', '${ORDER}', 'partner', '${PARTNER_A}', 5000, 'INR', 1, 5000, '${U_ADMIN}');
    INSERT INTO audit_logs (id, actor_id, action, subject_type, subject_id)
      VALUES ('${AUDIT}', '${U_ADMIN}', 'order.confirm', 'order', '${ORDER}');
    INSERT INTO approval_requests (id, type, subject_type, subject_id, payload, requested_by)
      VALUES ('${REQUEST}', 'product.publish', 'product', '${PRODUCT}', '{}', '${U_ADMIN}');
  `);
};

/** Runs `fn` in its own transaction and returns the Postgres error message (or null on success). */
const failure = async (statement: string): Promise<string | null> => {
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(statement);
    });
    return null;
  } catch (err) {
    return (err as Error).message;
  }
};

beforeAll(async () => {
  await migrateTestDb();
  await truncateAll();
  await seedFixtures();
});

describe("migrations", () => {
  it("apply on the fresh database and are idempotent (second run is a no-op)", async () => {
    await migrateTestDb();
    const rows = await sql<{ n: string }[]>`
      select count(*)::text as n from drizzle.__drizzle_migrations
    `;
    expect(Number(rows[0]?.n)).toBe(2);
  });

  it("create every docs/05 table", async () => {
    const rows = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
    `;
    const names = new Set(rows.map((r) => r.table_name));
    expect(DOC_TABLES.length).toBeGreaterThanOrEqual(70);
    const missing = DOC_TABLES.filter((t) => !names.has(t));
    expect(missing).toEqual([]);
  });

  it("create the reporting views and the immutable search helper", async () => {
    const views = await sql<{ table_name: string }[]>`
      select table_name from information_schema.views where table_schema = 'public' order by 1
    `;
    expect(views.map((v) => v.table_name)).toEqual(["customer_credits", "partner_balances"]);
    const [fn] = await sql<{ provolatile: string }[]>`
      select provolatile from pg_proc where proname = 'immutable_array_to_string'
    `;
    expect(fn?.provolatile).toBe("i");
  });

  it("wire every cross-domain foreign key", async () => {
    const rows = await sql<{ table_name: string; column_name: string; ref: string }[]>`
      select tc.table_name, kcu.column_name, ccu.table_name as ref
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
      where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
    `;
    const has = (t: string, c: string, ref: string) =>
      rows.some((r) => r.table_name === t && r.column_name === c && r.ref === ref);
    const expected: [string, string, string][] = [
      ["product_ownerships", "approval_request_id", "approval_requests"],
      ["custom_quotes", "offering_id", "offerings"],
      ["order_items", "offering_id", "offerings"],
      ["order_items", "product_id", "products"],
      ["order_items", "ownership_id", "product_ownerships"],
      ["user_offering_purchases", "offering_id", "offerings"],
      ["invoices", "pdf_media_id", "media"],
      ["credit_notes", "pdf_media_id", "media"],
      ["payouts", "partner_id", "partners"],
      ["ledger_entries", "partner_id", "partners"],
      ["expenses", "product_id", "products"],
      ["expenses", "receipt_media_id", "media"],
      ["allocations", "ownership_id", "product_ownerships"],
      ["entitlements", "offering_id", "offerings"],
      ["entitlements", "order_item_id", "order_items"],
      ["entitlements", "product_id", "products"],
      ["subscriptions", "renewal_order_id", "orders"],
      ["downloads", "media_id", "media"],
      ["release_files", "product_id", "products"],
      ["release_files", "media_id", "media"],
      ["leads", "product_id", "products"],
      ["leads", "won_order_id", "orders"],
      ["queries", "order_id", "orders"],
      ["queries", "product_id", "products"],
      ["analytics_events", "product_id", "products"],
      ["analytics_events", "order_id", "orders"],
    ];
    const missing = expected.filter(([t, c, r]) => !has(t, c, r));
    expect(missing).toEqual([]);
  });

  it("install the docs/05 §12 triggers", async () => {
    const rows = await sql<{ tgname: string; relname: string; deferred: boolean }[]>`
      select t.tgname, c.relname, t.tginitdeferred as deferred
      from pg_trigger t join pg_class c on c.oid = t.tgrelid
      where not t.tgisinternal
    `;
    for (const [table, names] of Object.entries(TRIGGERS)) {
      const found = rows.filter((r) => r.relname === table).map((r) => r.tgname);
      for (const n of names) expect(found, `${table}.${n}`).toContain(n);
    }
    expect(rows.find((r) => r.tgname === "trg_ownership_lines_sum")?.deferred).toBe(true);
  });

  it("keep the canonical custom SQL in sync with the migration", () => {
    const migration = readFileSync("drizzle/migrations/0001_daffy_turbo.sql", "utf8");
    for (const f of ["drizzle/custom/triggers.sql", "drizzle/custom/views.sql"]) {
      expect(migration, f).toContain(readFileSync(f, "utf8").trim());
    }
  });
});

describe("append-only tables", () => {
  it("reject UPDATE and DELETE on ledger_entries", async () => {
    expect(await failure(`UPDATE ledger_entries SET memo = 'x' WHERE id = '${LEDGER}'`)).toMatch(
      /append_only/,
    );
    expect(await failure(`DELETE FROM ledger_entries WHERE id = '${LEDGER}'`)).toMatch(
      /append_only/,
    );
  });

  it("reject UPDATE and DELETE on audit_logs", async () => {
    expect(await failure(`UPDATE audit_logs SET action = 'x' WHERE id = '${AUDIT}'`)).toMatch(
      /append_only/,
    );
    expect(await failure(`DELETE FROM audit_logs WHERE id = '${AUDIT}'`)).toMatch(/append_only/);
  });

  it("reject UPDATE and DELETE on invoices", async () => {
    expect(await failure(`UPDATE invoices SET fy = '2027-28' WHERE id = '${INVOICE}'`)).toMatch(
      /append_only/,
    );
    expect(await failure(`DELETE FROM invoices WHERE id = '${INVOICE}'`)).toMatch(/append_only/);
  });

  it("reject TRUNCATE on the six tables", async () => {
    for (const t of [
      "ledger_entries",
      "allocations",
      "payouts",
      "invoices",
      "credit_notes",
      "audit_logs",
    ]) {
      // CASCADE: payouts/invoices are FK targets and Postgres checks that before firing triggers
      expect(await failure(`TRUNCATE ${t} CASCADE`), t).toMatch(/append_only/);
    }
  });
});

describe("payments frozen after confirmed", () => {
  it("rejects changing the amount received and rejects confirmed → failed", async () => {
    expect(
      await failure(`UPDATE payments SET amount_received_minor = 1 WHERE id = '${PAYMENT}'`),
    ).toMatch(/payment_frozen/);
    expect(await failure(`UPDATE payments SET status = 'failed' WHERE id = '${PAYMENT}'`)).toMatch(
      /payment_frozen/,
    );
    expect(await failure(`DELETE FROM payments WHERE id = '${PAYMENT}'`)).toMatch(/payment_frozen/);
  });

  it("allows a growing amount_refunded_minor, then confirmed → refunded once", async () => {
    expect(
      await failure(`UPDATE payments SET amount_refunded_minor = 4000 WHERE id = '${PAYMENT}'`),
    ).toBeNull();
    expect(
      await failure(`UPDATE payments SET amount_refunded_minor = 3000 WHERE id = '${PAYMENT}'`),
    ).toMatch(/payment_frozen/);
    expect(
      await failure(
        `UPDATE payments SET status = 'refunded', amount_refunded_minor = 10000 WHERE id = '${PAYMENT}'`,
      ),
    ).toBeNull();
    // terminal: no second transition, no further change
    expect(
      await failure(`UPDATE payments SET status = 'confirmed' WHERE id = '${PAYMENT}'`),
    ).toMatch(/payment_frozen/);
    expect(
      await failure(`UPDATE payments SET amount_refunded_minor = 10001 WHERE id = '${PAYMENT}'`),
    ).toMatch(/payment_frozen/);
  });
});

describe("approval_decisions", () => {
  it("rejects decided_by = requested_by and accepts another admin", async () => {
    expect(
      await failure(
        `INSERT INTO approval_decisions (request_id, decided_by, decision) VALUES ('${REQUEST}', '${U_ADMIN}', 'approve')`,
      ),
    ).toMatch(/approver_is_requester/);
    expect(
      await failure(
        `INSERT INTO approval_decisions (request_id, decided_by, decision) VALUES ('${REQUEST}', '${U_ADMIN2}', 'approve')`,
      ),
    ).toBeNull();
  });
});

describe("product_ownership_lines sum", () => {
  it("rejects a sum ≠ 10000 at COMMIT and accepts exactly 10000 inserted line by line", async () => {
    const bad = await failure(`
      INSERT INTO product_ownerships (id, product_id, version, created_by)
        VALUES ('${OWN_A}', '${PRODUCT}', 1, '${U_ADMIN}');
      INSERT INTO product_ownership_lines (ownership_id, partner_id, share_bps) VALUES ('${OWN_A}', '${PARTNER_A}', 6000);
      INSERT INTO product_ownership_lines (ownership_id, partner_id, share_bps) VALUES ('${OWN_A}', '${PARTNER_B}', 3999);
    `);
    expect(bad).toMatch(/ownership_lines_sum/);
    const [cnt] = await sql<{ n: string }[]>`
      select count(*)::text as n from product_ownerships where id = ${OWN_A}
    `;
    expect(Number(cnt?.n)).toBe(0); // the whole transaction rolled back

    const ok = await failure(`
      INSERT INTO product_ownerships (id, product_id, version, created_by)
        VALUES ('${OWN_A}', '${PRODUCT}', 1, '${U_ADMIN}');
      INSERT INTO product_ownership_lines (ownership_id, partner_id, share_bps) VALUES ('${OWN_A}', '${PARTNER_A}', 6000);
      INSERT INTO product_ownership_lines (ownership_id, partner_id, share_bps) VALUES ('${OWN_A}', '${PARTNER_B}', 4000);
    `);
    expect(ok).toBeNull();

    // later edits are checked too: 6000 → 6001 breaks the sum
    expect(
      await failure(
        `UPDATE product_ownership_lines SET share_bps = 6001 WHERE ownership_id = '${OWN_A}' AND partner_id = '${PARTNER_A}'`,
      ),
    ).toMatch(/ownership_lines_sum/);
  });
});

describe("categories depth", () => {
  it("allows two levels and rejects a third", async () => {
    expect(
      await failure(`
        INSERT INTO categories (id, name, slug) VALUES ('00000000-0000-4000-8000-0000000000a1', 'Root', 'root');
        INSERT INTO categories (id, name, slug, parent_id)
          VALUES ('00000000-0000-4000-8000-0000000000a2', 'Child', 'child', '00000000-0000-4000-8000-0000000000a1');
      `),
    ).toBeNull();
    expect(
      await failure(`
        INSERT INTO categories (name, slug, parent_id)
          VALUES ('Grandchild', 'grandchild', '00000000-0000-4000-8000-0000000000a2')
      `),
    ).toMatch(/category_depth/);
    // a category with children cannot be re-parented under another category
    expect(
      await failure(`
        INSERT INTO categories (id, name, slug) VALUES ('00000000-0000-4000-8000-0000000000a3', 'Other', 'other');
        UPDATE categories SET parent_id = '00000000-0000-4000-8000-0000000000a3'
          WHERE id = '00000000-0000-4000-8000-0000000000a1';
      `),
    ).toMatch(/category_depth/);
  });
});

describe("views", () => {
  it("partner_balances sums the partner's ledger rows per currency", async () => {
    await sql.unsafe(`
      INSERT INTO ledger_entries (entry_type, party_type, partner_id, amount_minor, currency, fx_rate_to_inr, amount_inr_minor, created_by)
      VALUES ('payout', 'partner', '${PARTNER_A}', -2000, 'INR', 1, -2000, '${U_ADMIN}'),
             ('refund_partner_allocation', 'partner', '${PARTNER_A}', -500, 'INR', 1, -500, '${U_ADMIN}'),
             ('partner_allocation', 'partner', '${PARTNER_A}', 100, 'USD', 84.5, 8450, '${U_ADMIN}')
    `);
    const rows = await sql<Record<string, string | number | Date | null>[]>`
      select * from partner_balances where partner_id = ${PARTNER_A} order by currency
    `;
    expect(rows).toHaveLength(2);
    const inr = rows.find((r) => r.currency === "INR")!;
    expect(Number(inr.allocated_minor)).toBe(5000);
    expect(Number(inr.refunded_minor)).toBe(500);
    expect(Number(inr.paid_out_minor)).toBe(2000);
    expect(Number(inr.balance_minor)).toBe(2500);
    expect(Number(inr.balance_inr_minor)).toBe(2500);
    const usd = rows.find((r) => r.currency === "USD")!;
    expect(Number(usd.balance_minor)).toBe(100);
    expect(Number(usd.balance_inr_minor)).toBe(8450);
    expect(Object.keys(inr).sort()).toEqual(
      [
        "partner_id",
        "currency",
        "allocated_minor",
        "refunded_minor",
        "expenses_minor",
        "paid_out_minor",
        "adjusted_minor",
        "balance_minor",
        "balance_inr_minor",
        "last_entry_at",
      ].sort(),
    );
  });

  it("customer_credits lists confirmed overpayments only", async () => {
    const before = await sql`select * from customer_credits`;
    expect(before).toHaveLength(0); // the fixture payment is refunded by now
    const P2 = "00000000-0000-4000-8000-000000000042";
    await sql.unsafe(`
      INSERT INTO payments (id, order_id, provider, status, amount_due_minor, amount_received_minor, customer_credit_minor, currency)
      VALUES ('${P2}', '${ORDER}', 'manual_bank', 'confirmed', 10000, 10250, 250, 'INR')
    `);
    const rows = await sql<
      { payment_id: string; credit_minor: string; credit_inr_minor: string }[]
    >`
      select payment_id, credit_minor, credit_inr_minor from customer_credits
    `;
    expect(rows).toEqual([{ payment_id: P2, credit_minor: "250", credit_inr_minor: "250" }]);
  });
});
