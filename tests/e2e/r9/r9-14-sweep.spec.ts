/**
 * R9-14: full route sweep by role. Every page.tsx under (site), (account), (auth) and (admin) is
 * visited per role at 375/768/1280. Per visit: correct allow/deny/redirect, no console errors,
 * no 4xx/5xx responses (bar the listed expected ones), no broken screen text, no horizontal
 * overflow. Admin below 1024px shows the deliberate laptop notice, which counts as a clean page.
 * Dynamic ids come from seeded rows (q()). Desktop project only: it sets each viewport itself.
 */
import fs from "node:fs";
import { expect, test, type Cookie, type Page } from "@playwright/test";
import { ADMIN, SITE, WIDTHS, authFile, expectNoOverflow, q, type Role } from "./helpers";

type Row = Record<string, string>;
/** Ids resolved in beforeAll from seeded data. */
const F: Record<string, string> = {};

test.skip(({ viewport }) => (viewport?.width ?? 1280) < 1000, "sweep sets its own viewports");

test.beforeAll(async () => {
  const one = async (sql: string, p: unknown[] = []) => (await q<Row>(sql, p))[0];
  const buyer = (await one(`select id, email from users where email='buyer@codekraft.test'`))!;
  const prod = (await one(`select id, slug from products where slug='tradeflow'`))!;
  const off = (await one(
    `select id, delivery_type from offerings where product_id=$1 and status='active' limit 1`,
    [prod.id],
  ))!;
  F.product = prod.slug!;
  F.productId = prod.id!;
  F.offering = off.id!;
  F.buyerId = buyer.id!;
  F.caseStudy = (await one(`select slug from case_studies limit 1`))!.slug!;
  F.blog = (await one(`select slug from product_blogs limit 1`))?.slug ?? "";

  const snap = JSON.stringify({ name: "Buyer", email: buyer.email, country: "IN" });
  const mkOrder = async (no: string, status: string) => {
    const ex = await one(`select id from orders where order_no=$1`, [no]);
    if (ex) return ex.id!;
    const o = (await one(
      `insert into orders (order_no, type, user_id, status, currency, subtotal_minor, total_minor,
         billing_snapshot, fx_rate_to_inr, expires_at, paid_at)
       values ($1,'product',$2,'${status}','INR',100000,100000,$3::jsonb,1, now() + interval '7 days',
         ${status === "paid" ? "now()" : "null"}) returning id`,
      [no, buyer.id, snap],
    ))!;
    await q(
      `insert into order_items (order_id, offering_id, product_id, description, unit_minor, total_minor)
       values ($1,$2,$3,'R914 item',100000,100000)`,
      [o.id, off.id, prod.id],
    );
    return o.id!;
  };
  F.orderNo = "CK-ORD-914001";
  F.order = await mkOrder(F.orderNo, "pending_payment");
  if (!(await one(`select 1 x from payments where order_id=$1`, [F.order])))
    await q(
      `insert into payments (order_id, provider, status, amount_due_minor, currency, customer_reference, customer_submitted_at)
       values ($1,'manual_upi','submitted',100000,'INR','R914UTR', now())`,
      [F.order],
    );
  const paid = await mkOrder("CK-ORD-914002", "paid");

  let inv = await one(`select id from invoices where order_id=$1`, [paid]);
  inv ??= await one(
    `insert into invoices (invoice_no, order_id, fy, seq, seller_snapshot, buyer_snapshot, lines,
       subtotal_minor, discount_minor, tax_minor, total_minor, currency)
     values ('CK/R914/1',$1,'2026-27',914000,$2::jsonb,$3::jsonb,$4::jsonb,100000,0,0,100000,'INR') returning id`,
    [
      paid,
      JSON.stringify({
        name: "CodeKraft",
        address: "1 Road, Pune, 411001",
        gst_number: "27AAAAA0000A1Z5",
        email: "s@example.test",
        state_code: "MH",
      }),
      snap,
      JSON.stringify([
        {
          description: "R914 item",
          quantity: 1,
          unit_minor: 100000,
          discount_minor: 0,
          tax_minor: 0,
          total_minor: 100000,
        },
      ]),
    ],
  );
  F.invoice = inv!.id!;

  let ent = await one(`select id from entitlements where user_id=$1 limit 1`, [buyer.id]);
  ent ??= await one(
    `insert into entitlements (user_id, offering_id, order_item_id, product_id, delivery_type, update_policy)
     select $1,$2,i.id,$3,$4::delivery_type,(enum_range(null::update_policy))[1]
     from order_items i where i.order_id=$5 limit 1 returning id`,
    [buyer.id, off.id, prod.id, off.delivery_type, paid],
  );
  F.entitlement = ent!.id!;

  let lead = await one(`select id from leads where name='R914 Lead'`);
  lead ??= await one(
    `insert into leads (source, name, email, message) values ('manual','R914 Lead','r914@example.test','hello') returning id`,
  );
  F.lead = lead!.id!;

  let qy = await one(`select id from queries where subject='R914 query'`);
  if (!qy) {
    qy = await one(
      `insert into queries (user_id, subject, source) values ($1,'R914 query','form') returning id`,
      [buyer.id],
    );
    await q(
      `insert into query_messages (query_id, author_id, author_kind, body_json)
       values ($1,$2,'customer',$3::jsonb)`,
      [
        qy!.id,
        buyer.id,
        JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hello there" }] }],
        }),
      ],
    );
  }
  F.query = qy!.id!;

  let cq = await one(`select token from custom_quotes where title='R914 quote'`);
  cq ??= await one(
    `insert into custom_quotes (customer_id, title, currency, amount_minor, token, status, sent_at, expires_at)
     values ($1,'R914 quote','INR',250000,$2,'sent',now(), now() + interval '10 days') returning token`,
    [buyer.id, `r914${"x".repeat(30)}`],
  );
  F.quote = cq!.token!;
});

// ---- route tables -------------------------------------------------------------------------
type P = string | ((f: typeof F) => string);
const SITE_PUBLIC: P[] = [
  "/",
  "/products",
  (f) => `/products/${f.product}`,
  "/projects",
  (f) => `/projects/${f.caseStudy}`,
  "/blog",
  (f) => `/blog/${f.blog}`,
  "/services",
  "/contact",
  "/legal/privacy",
  "/legal/terms",
  "/legal/refunds",
  "/legal/license",
];
const AUTH_PAGES: P[] = ["/auth/login", "/auth/register", "/auth/reset", "/auth/verify"];
const ACCOUNT: P[] = [
  "/account",
  "/account/orders",
  (f) => `/account/orders/${f.orderNo}`,
  "/account/purchases",
  (f) => `/account/purchases/${f.entitlement}`,
  "/account/invoices",
  (f) => `/account/invoices/${f.invoice}`,
  "/account/quotes",
  "/account/queries",
  (f) => `/account/queries/${f.query}`,
  "/account/wishlist",
  "/account/notifications",
  "/account/settings",
  "/account/chat",
  (f) => `/checkout/${f.offering}`,
  (f) => `/checkout/confirming/${f.orderNo}`,
  (f) => `/quote/${f.quote}`,
];
const ADMIN_PAGES: P[] = [
  "/admin/dashboard",
  "/admin/products",
  (f) => `/admin/products/${f.productId}`,
  "/admin/categories",
  "/admin/orders",
  "/admin/orders/new",
  (f) => `/admin/orders/${f.order}`,
  "/admin/customers",
  (f) => `/admin/customers/${f.buyerId}`,
  "/admin/quotes",
  "/admin/leads",
  "/admin/leads/board",
  (f) => `/admin/leads/${f.lead}`,
  "/admin/queries",
  (f) => `/admin/queries/${f.query}`,
  "/admin/chatbot",
  "/admin/delivery-tasks",
  "/admin/coupons",
  "/admin/entitlements",
  "/admin/approvals",
  "/admin/notifications",
  "/admin/audit",
  "/admin/admin-users",
  "/admin/settings",
  "/admin/content/landing",
  "/admin/content/testimonials",
  "/admin/content/blog",
  "/admin/content/case-studies",
  "/admin/content/faqs",
  "/admin/content/legal",
  "/admin/content/services",
  "/admin/finance",
  "/admin/finance/invoices",
  (f) => `/admin/finance/invoices/${f.invoice}`,
  "/admin/finance/ledger",
  "/admin/finance/reports",
  "/admin/finance/expenses",
  "/admin/finance/adjustments",
  "/admin/finance/partners",
  "/admin/finance/payouts",
  "/admin/finance/allocations",
];
// Staff (src/lib/authz/permissions.ts STAFF + admin-routes.ts): no ledger/allocations/partners/
// expenses/adjustments, no admin users, no audit, no approvals.
const STAFF_DENIED = new Set([
  "/admin/finance/ledger",
  "/admin/finance/allocations",
  "/admin/finance/partners",
  "/admin/finance/expenses",
  "/admin/finance/adjustments",
  "/admin/admin-users",
  "/admin/audit",
  "/admin/approvals",
]);
/** Deliberate redirects (BUG-047 / orders index): requested path -> where it must land. */
const REDIRECTS: Record<string, RegExp> = {
  "/account/orders": /^\/account\/purchases$/,
  "/admin/finance": /^\/admin\/finance\/ledger$/,
  "/admin/finance/invoices": /^\/admin\/finance\/reports$/,
  "/admin/finance/payouts": /^\/admin\/finance\/partners$/,
};
const resolve = (p: P) => (typeof p === "function" ? p(F) : p);
const label = (p: P) =>
  typeof p === "function" ? p(new Proxy({}, { get: (_t, k) => `:${String(k)}` }) as typeof F) : p;

// ---- the sweep ----------------------------------------------------------------------------
const BROKEN =
  /\bNaN\b|\bundefined\b|\[object Object\]|Application error|Something went wrong|This page couldn.t load|Unhandled Runtime Error|Internal Server Error/;

async function signIn(page: Page, role: Role | "anonymous") {
  if (role === "anonymous") return;
  const state = JSON.parse(fs.readFileSync(authFile(role), "utf8")) as { cookies: Cookie[] };
  await page.context().addCookies(state.cookies);
}

interface Expect {
  /** Final pathname after any redirect. Default: the requested path. */
  lands?: RegExp;
  /** The page is the admin "no access" panel. */
  denied?: boolean;
  /** Skip the broken-text scan (error pages that legitimately say so). */
  notFound?: boolean;
  /** Admin detail pages answer 200 with an in-shell "not found" panel (no throw). */
  softNotFound?: boolean;
}

async function sweep(
  page: Page,
  base: string,
  path: string,
  ex: Expect,
  widths: readonly number[],
) {
  const issues: string[] = [];
  await q(`delete from rate_limit_buckets`); // the sweep is far above real per-IP limits
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
      issues.push(`console: ${m.text().slice(0, 160)}`);
  });
  page.on("pageerror", (e) => issues.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on("response", (r) => {
    const s = r.status();
    const u = new URL(r.url());
    if (s < 400 || (ex.notFound && r.request().resourceType() === "document")) return;
    // A 3xx is fine; 401 from the session probe for signed-out visitors is expected.
    // Seed rows point at logo files that were never uploaded to local storage (seed artifact).
    if (s === 404 && /^\/api\/files\/public\/seed\//.test(u.pathname)) return;
    if (s === 401 && /\/api\/auth\/get-session/.test(u.pathname)) return;
    // The session probe is capped at 30/min per IP; a sweep loads far more pages than a person.
    if (s === 429 && /\/api\/auth\/get-session/.test(u.pathname)) return;
    issues.push(`${s} ${u.pathname}`);
  });
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    const res = await page.goto(`${base}${path}`, { timeout: 25_000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    const at = `${path} @${w}`;
    if (ex.notFound) expect(res?.status(), `${at} status`).toBe(404);
    else if (ex.softNotFound) expect(res?.status(), `${at} status`).toBe(200);
    else expect(res?.status() ?? 0, `${at} status`).toBeLessThan(400);
    const want =
      ex.lands ??
      new RegExp(`^${new URL(path, base).pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
    expect(new URL(page.url()).pathname, `${at} landed on`).toMatch(want);
    if (ex.softNotFound) {
      await expect(page.locator("body"), `${at} not-found panel`).toContainText(/not found/i);
    } else if (ex.denied) {
      await expect(page.getByTestId("admin-no-access"), `${at} no-access panel`).toBeVisible();
    } else {
      await expect(
        page.locator("main:visible, [role=main]:visible, h1:visible").first(),
        `${at} main`,
      ).toBeVisible();
      const text = (await page.locator("main:visible, body").first().innerText()).trim();
      expect(text.length, `${at} empty screen`).toBeGreaterThan(20);
      if (!ex.notFound) expect(text.match(BROKEN)?.[0] ?? null, `${at} broken text`).toBeNull();
    }
    await expectNoOverflow(page);
  }
  expect(issues, issues.join("\n")).toEqual([]);
}

const LOGIN = /^\/auth\/login$/;

test.describe("anonymous", () => {
  for (const p of [...SITE_PUBLIC, ...AUTH_PAGES])
    test(`[anonymous] ${label(p)} - loads at 375/768/1280`, async ({ page }) => {
      const path = resolve(p);
      test.skip(path === "/blog/", "no blog post seeded");
      await sweep(page, SITE, path, {}, WIDTHS);
    });
  for (const p of ACCOUNT)
    test(`[anonymous] ${label(p)} - redirects to login`, async ({ page }) => {
      await sweep(page, SITE, resolve(p), { lands: LOGIN }, [1280]);
    });
  for (const p of ["/admin", ...ADMIN_PAGES])
    test(`[anonymous] ${label(p)} - redirects to login`, async ({ page }) => {
      await sweep(page, ADMIN, resolve(p), { lands: LOGIN }, [1280]);
    });
  test("[anonymous] /search - hands the query to /products at every width", async ({ page }) => {
    await sweep(page, SITE, "/search?q=trade", { lands: /^\/products$/ }, WIDTHS);
  });
  test("[anonymous] /auth/invite/bogus-token - bad invite is handled, not a crash", async ({
    page,
  }) => {
    const r = await page.goto(`${SITE}/auth/invite/bogus-token`);
    expect(r?.status() ?? 0).toBeLessThan(500);
    await expectNoOverflow(page);
  });
  test("[anonymous] /nope-404 - unknown URL gives a real 404 page", async ({ page }) => {
    await sweep(page, SITE, "/nope-404", { notFound: true }, WIDTHS);
  });
});

test.describe("customer", () => {
  test.beforeEach(({ page }) => signIn(page, "customer"));
  for (const p of [...SITE_PUBLIC])
    test(`[customer] ${label(p)} - public page loads at 375/768/1280`, async ({ page }) => {
      const path = resolve(p);
      test.skip(path === "/blog/", "no blog post seeded");
      await sweep(page, SITE, path, {}, WIDTHS);
    });
  for (const p of ACCOUNT)
    test(`[customer] ${label(p)} - loads at 375/768/1280`, async ({ page }) => {
      await sweep(page, SITE, resolve(p), { lands: REDIRECTS[label(p)] }, WIDTHS);
    });
  for (const [fam, path] of [
    ["orders", "/account/orders/00000000-0000-4000-8000-000000000000"],
    ["purchases", "/account/purchases/00000000-0000-4000-8000-000000000000"],
    ["invoices", "/account/invoices/00000000-0000-4000-8000-000000000000"],
    ["queries", "/account/queries/00000000-0000-4000-8000-000000000000"],
    ["quote", "/quote/not-a-real-token-123"],
  ] as const)
    test(`[customer] ${path} - unknown ${fam} id gives a 404, not a crash`, async ({ page }) => {
      await sweep(page, SITE, path, { notFound: true }, [1280]);
    });
  for (const p of ["/admin/dashboard", "/admin/orders", "/admin/finance/ledger"])
    test(`[customer] ${p} - customer session is not an admin session`, async ({ page }) => {
      await sweep(page, ADMIN, p, { lands: LOGIN }, [1280]);
    });
});

for (const role of ["super_admin", "admin", "staff"] as const) {
  test.describe(role, () => {
    test.beforeEach(({ page }) => signIn(page, role));
    test(`[${role}] /admin - lands on the dashboard`, async ({ page }) => {
      await sweep(page, ADMIN, "/admin", { lands: /^\/admin\/dashboard$/ }, [1280]);
    });
    for (const p of ADMIN_PAGES) {
      const name = label(p);
      const denied = role === "staff" && (STAFF_DENIED.has(name) || name === "/admin/finance");
      // Admins/staff only open products they created (D-512): the seeded one is not theirs.
      const notOwned = role !== "super_admin" && name === "/admin/products/:productId";
      test(`[${role}] ${name} - ${denied ? "denied" : notOwned ? "not owned gives 404" : "loads at 375/768/1280"}`, async ({
        page,
      }) => {
        const lands = REDIRECTS[name];
        await sweep(
          page,
          ADMIN,
          resolve(p),
          { denied, lands, notFound: notOwned },
          denied || notOwned ? [1280] : WIDTHS,
        );
      });
    }
    for (const [p, soft] of [
      ["/admin/orders/00000000-0000-4000-8000-000000000000", true],
      ["/admin/customers/00000000-0000-4000-8000-000000000000", true],
      ["/admin/products/00000000-0000-4000-8000-000000000000", false],
    ] as const)
      test(`[${role}] ${p} - unknown id gives a not-found screen, not a crash`, async ({
        page,
      }) => {
        await sweep(page, ADMIN, p, soft ? { softNotFound: true } : { notFound: true }, [1280]);
      });
  });
}
