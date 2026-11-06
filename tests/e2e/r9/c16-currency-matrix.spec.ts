/**
 * C16-06 round 2: currency (INR/USD/EUR/GBP/CAD) x role (anonymous, customer, super_admin, admin,
 * staff) x pages. Product and checkout prices must be the INR base converted at a real rate
 * (within 25% of the static table: live rates drift, GBP was 17% off on 2026-11-06, and the bug
 * this guards against is a 100x error)
 * and never the INR number with a foreign symbol (the "Rs 1001 -> $1001" bug). Rates are not
 * written here: r9-09 owns today's manual rate rows. Other pages must render in the viewer
 * currency without errors; staff may get a permission notice on finance pages.
 * Mutates the role users' display currency: run it in its own invocation, like the R9-14 sweep.
 */
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, ROLE_EMAILS, SITE, loginAs, q, trackIssues, type Role } from "./helpers";

const SLUG = "resume-portfolio-website";
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "CAD"] as const;
type Cur = (typeof CURRENCIES)[number];
// STATIC_FX_TABLE values; live rates sit within the 25% band.
const RATES: Record<Cur, string> = {
  INR: "1",
  USD: "0.01200000",
  EUR: "0.01100000",
  GBP: "0.00950000",
  CAD: "0.01630000",
};
const SYMBOL: Record<Cur, RegExp> = { INR: /₹/, USD: /\$/, EUR: /€/, GBP: /£/, CAD: /CA\$|\$/ };

const major = (minor: number) => (minor / 100).toFixed(2);
const text = async (page: Page) => (await page.locator("body").innerText()).replace(/,/g, "");
/** Some amount on the page is the INR base converted to `c` (+/- 15%). */
const hasConverted = (body: string, inrMinor: number, c: Cur) => {
  const want = inrMinor * Number(RATES[c]);
  return (body.match(/\d+\.\d{2}/g) ?? []).some((n) => {
    const v = Number(n) * 100;
    return v >= want * 0.75 && v <= want * 1.25;
  });
};

let offeringId = "";
let inrMinor = 0;

test.beforeAll(async () => {
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
  expect(hasConverted(body, inrMinor, c), `product price in ${c}`).toBe(true);
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
        // NULL = "no own choice": an 'INR' here would pin the user and hide default changes
        await q(`update users set display_currency = null where lower(email) = lower($1)`, [
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
            expect(hasConverted(await text(page), inrMinor, c), `checkout in ${c}`).toBe(true);
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

// D17-02: the admin's default (base) currency reaches everyone who has not chosen their own.
// The base currency is locked once a paid order exists, so this skips on such a database.
test.describe("admin default currency change", () => {
  test.describe.configure({ mode: "serial" });
  const NEW_DEFAULT: Cur = "EUR";

  async function setDefaultViaUi(page: Page, c: Cur) {
    await page.goto(`${ADMIN}/admin/settings`);
    await page.getByRole("button", { name: "Currencies", exact: true }).click();
    await page.locator("#st-base").click();
    await page.getByRole("option", { name: c, exact: true }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible({ timeout: 30_000 });
  }

  test.beforeAll(async () => {
    const [paid] = await q<{ n: string }>(`select count(*) n from orders where status = 'paid'`);
    test.skip(Number(paid?.n) > 0, "base currency is locked once a paid order exists");
    await q(`update users set display_currency = null where lower(email) = lower($1)`, [
      ROLE_EMAILS.customer,
    ]);
  });

  test.afterAll(async ({ browser }) => {
    await q(`update users set display_currency = null where lower(email) = lower($1)`, [
      ROLE_EMAILS.customer,
    ]);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await loginAs(page, "super_admin");
      await setDefaultViaUi(page, "INR"); // restore
    } finally {
      await page.close();
    }
  });

  test("anonymous and no-choice customer follow the new default; a chooser does not", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const admin = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await loginAs(admin, "super_admin");
    await setDefaultViaUi(admin, NEW_DEFAULT);
    await admin.close();

    const onProduct = async (viewer: Viewer, c: Cur) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        if (viewer !== "anonymous") await loginAs(page, viewer as Role);
        await expect
          .poll(
            async () => {
              await visit(page, `${SITE}/products/${SLUG}`);
              return hasConverted(await text(page), inrMinor, c);
            },
            { timeout: 60_000, message: `${viewer} sees ${c}` },
          )
          .toBe(true);
        expect(await text(page)).toMatch(SYMBOL[c]);
      } finally {
        await ctx.close();
      }
    };
    await onProduct("anonymous", NEW_DEFAULT); // cached twin refreshed by the admin save
    await onProduct("customer", NEW_DEFAULT); // signed in, no own choice
    // A customer who chose USD stays on it. (Admin users are signed in on the admin host only.)
    await q(`update users set display_currency = 'USD' where lower(email) = lower($1)`, [
      ROLE_EMAILS.customer,
    ]);
    await onProduct("customer", "USD");
  });
});
