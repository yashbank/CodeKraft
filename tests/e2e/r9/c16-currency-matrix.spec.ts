/**
 * C16-06 round 2: currency (INR/USD/EUR/GBP/CAD) x role (anonymous, customer, super_admin, admin,
 * staff) x pages. Seeds manual INR->X rates for today, so the expected price is exact and no
 * network is needed. Product price must equal the INR base converted (never the INR number with
 * a foreign symbol: the "Rs 1001 -> $1001" bug). Other pages must render in the viewer currency
 * without errors; staff may get a permission notice on finance pages.
 */
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, ROLE_EMAILS, SITE, loginAs, q, trackIssues, type Role } from "./helpers";

const SLUG = "resume-portfolio-website";
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "CAD"] as const;
type Cur = (typeof CURRENCIES)[number];
// Same values as STATIC_FX_TABLE, so a cached table from before the seed agrees too.
const RATES: Record<Cur, string> = {
  INR: "1",
  USD: "0.01200000",
  EUR: "0.01100000",
  GBP: "0.00950000",
  CAD: "0.01630000",
};
const SYMBOL: Record<Cur, RegExp> = { INR: /₹/, USD: /\$/, EUR: /€/, GBP: /£/, CAD: /CA\$|\$/ };

const major = (minor: number) => (minor / 100).toFixed(2);
const convert = (inrMinor: number, c: Cur) => Math.round(inrMinor * Number(RATES[c]));
const text = async (page: Page) => (await page.locator("body").innerText()).replace(/,/g, "");

let offeringId = "";
let inrMinor = 0;

test.beforeAll(async () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const c of CURRENCIES.filter((x) => x !== "INR")) {
    const inv = (1 / Number(RATES[c])).toFixed(8);
    for (const [b, qt, r] of [
      ["INR", c, RATES[c]],
      [c, "INR", inv],
    ]) {
      await q(
        `insert into fx_rates (base, quote, rate, as_of, source) values ($1,$2,$3,$4,'manual')
         on conflict (base, quote, as_of) do update set rate = excluded.rate, source = 'manual', created_at = now()`,
        [b, qt, r, today],
      );
    }
  }
  const [row] = await q<{ id: string; amount_minor: string }>(
    `select o.id, op.amount_minor from offerings o
       join products p on p.id = o.product_id
       join offering_prices op on op.offering_id = o.id and op.currency = 'INR'
      where p.slug = $1 and o.status = 'active' and o.purchase_model <> 'custom_quote'
      order by op.amount_minor asc limit 1`,
    [SLUG],
  );
  if (!row) throw new Error(`seeded product ${SLUG} has no INR-priced offering`);
  offeringId = row.id;
  inrMinor = Number(row.amount_minor);
  // the bug's precondition must not exist in the seed: no explicit non-INR copy rows
  const copies = await q(
    `select 1 from offering_prices where offering_id = $1 and currency <> 'INR'`,
    [offeringId],
  );
  expect(copies).toHaveLength(0);
});

type Viewer = "anonymous" | Role;
const VIEWERS: Viewer[] = ["anonymous", "customer", "super_admin", "admin", "staff"];

async function setCurrency(page: Page, viewer: Viewer, c: Cur) {
  if (viewer !== "anonymous") {
    await q(`update users set display_currency = $1 where lower(email) = lower($2)`, [
      c,
      ROLE_EMAILS[viewer],
    ]);
    await loginAs(page, viewer);
  }
  for (const url of [SITE, ADMIN])
    await page.context().addCookies([{ name: "ck_currency", value: c, url }]);
}

async function expectProductPrice(page: Page, c: Cur) {
  await visit(page, `${SITE}/products/${SLUG}`);
  const body = await text(page);
  expect(body, `product price in ${c}`).toContain(major(convert(inrMinor, c)));
  expect(body).toMatch(SYMBOL[c]);
  // the bug: the INR number shown with a foreign symbol
  if (c !== "INR") expect(body).not.toMatch(new RegExp(`[$€£]\\s?${major(inrMinor)}\\b`));
}

/** goto that settles client redirects (e.g. /finance/invoices -> reports for some roles). */
async function visit(page: Page, url: string) {
  const res = await page.goto(url).catch((e: Error) => {
    if (!/ERR_ABORTED/.test(e.message)) throw e;
    return null; // superseded by a client redirect; the settled page is checked below
  });
  await page.waitForLoadState("networkidle");
  return res;
}

async function expectAdminPage(page: Page, viewer: Viewer, path: string, c: Cur) {
  const res = await visit(page, `${ADMIN}${path}`);
  expect(res?.status() ?? 200, `${viewer} ${path}`).toBeLessThan(500);
  const body = await page.locator("body").innerText();
  if (/not allowed|no access|permission|forbidden|404/i.test(body)) {
    expect(viewer, `${viewer} denied ${path}`).toBe("staff");
    return;
  }
  // money-bearing screens show the viewer currency once they have any amount
  if (/\d+\.\d{2}/.test(body)) expect(body, `${viewer} ${path} in ${c}`).toMatch(SYMBOL[c]);
}

for (const viewer of VIEWERS) {
  // one user per viewer: its display_currency is shared state, so its currencies run in order
  test.describe(viewer, () => {
    test.describe.configure({ mode: "serial" });
    // reset only this viewer: a file-level afterAll runs per worker and would race other groups
    test.afterAll(async () => {
      if (viewer !== "anonymous")
        await q(`update users set display_currency = 'INR' where lower(email) = lower($1)`, [
          ROLE_EMAILS[viewer],
        ]);
    });
    for (const c of CURRENCIES) {
      test(`${viewer} sees ${c}`, async ({ page, isMobile }) => {
        test.setTimeout(120_000);
        const issues = trackIssues(page, [/429/]);
        await setCurrency(page, viewer, c);

        await expectProductPrice(page, c);

        if (viewer === "anonymous" || viewer === "customer") {
          const res = await visit(page, `${SITE}/checkout/${offeringId}`);
          expect(res?.status() ?? 0).toBeLessThan(500);
          if (viewer === "customer") {
            expect(await text(page), `checkout in ${c}`).toContain(major(convert(inrMinor, c)));
            for (const path of ["/account/purchases", "/account/invoices"]) {
              const r = await visit(page, `${SITE}${path}`);
              expect(r?.status() ?? 0, path).toBeLessThan(500);
            }
          }
        } else if (!isMobile) {
          // admin is laptop-only below 1024 (LaptopNotice), so admin pages run on desktop
          for (const path of [
            "/dashboard",
            "/finance/ledger", // "/finance" is a redirect to the ledger
            "/finance/invoices",
            "/finance/reports",
          ])
            await expectAdminPage(page, viewer, path, c);
          const exp = await page.request.get(`${ADMIN}/api/admin/export/ledger`);
          expect(exp.status(), `${viewer} ledger export`).toBeLessThan(500);
          if (viewer !== "staff") expect(exp.status()).toBe(200);
        }
        issues.assertClean();
      });
    }
  });
}
