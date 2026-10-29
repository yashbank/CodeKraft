/**
 * R9-09: one trusted FX rate. Seeds an admin override (1 USD = 80 INR, so no network is needed),
 * records a USD expense as a super admin and checks the INR amount, then checks the storefront
 * display-currency conversion. 375 / 768 / 1280.
 */
import { expect, test } from "@playwright/test";
import { ADMIN, SITE, atWidths, loginAs, q, trackIssues } from "./helpers";

const SLUG = "resume-portfolio-website";

test("USD expense converts at the trusted rate; storefront USD matches", async ({
  page,
  isMobile,
}) => {
  // Expenses render only a LaptopNotice below 1024px (docs/07 §3.4); the 375 storefront runs on desktop.
  test.skip(isMobile, "admin finance is laptop-only (LaptopNotice below lg)");
  const issues = trackIssues(page);
  const today = new Date().toISOString().slice(0, 10);
  // admin override for today wins over the live provider: INR->USD 0.0125, USD->INR 80
  for (const [b, qt, rate] of [
    ["INR", "USD", "0.01250000"],
    ["USD", "INR", "80.00000000"],
  ]) {
    await q(
      `insert into fx_rates (base, quote, rate, as_of, source) values ($1,$2,$3,$4,'manual')
       on conflict (base, quote, as_of) do update set rate = excluded.rate, source = 'manual', created_at = now()`,
      [b, qt, rate, today],
    );
  }

  await loginAs(page, "super_admin");
  await page.goto(`${ADMIN}/finance/expenses`);
  await page.getByRole("button", { name: "Record expense" }).first().click();
  const desc = `FX check ${Date.now()}`;
  await page.getByLabel("Description").fill(desc);
  await page.getByLabel("Amount").fill("10");
  await page.locator("#ex-currency").click();
  await page.getByRole("option", { name: "USD" }).click();
  await expect(page.getByText(/1 USD = 80\.00 INR/).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Record", exact: true }).click();

  const row = page.getByRole("row", { name: new RegExp(desc) });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row).toContainText("$10.00");
  await expect(row).toContainText("₹800.00"); // 10 USD x 80, 2dp
  const [exp] = await q<{ fx_rate_to_inr: string }>(
    `select fx_rate_to_inr from expenses where description = $1`,
    [desc],
  );
  expect(Number(exp?.fx_rate_to_inr)).toBe(80);

  // the rate changes later: the stored expense keeps its locked rate
  await q(
    `update fx_rates set rate = '90.00000000' where base='USD' and quote='INR' and as_of=$1`,
    [today],
  );
  await page.reload();
  await expect(page.getByRole("row", { name: new RegExp(desc) })).toContainText("₹800.00");

  // storefront: INR base price shown in USD at the same stored rate (INR->USD 0.0125)
  const [p] = await q<{ amount_minor: string }>(
    `select op.amount_minor from offering_prices op
       join offerings o on o.id = op.offering_id join products pr on pr.id = o.product_id
      where pr.slug = $1 and op.currency = 'INR' order by op.amount_minor limit 1`,
    [SLUG],
  );
  const usd = await q(
    `select 1 from offering_prices op join offerings o on o.id = op.offering_id
       join products pr on pr.id = o.product_id where pr.slug = $1 and op.currency = 'USD'`,
    [SLUG],
  );
  const expected = (Math.round(Number(p?.amount_minor) * 0.0125) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
  });
  const ctx = page.context();
  await ctx.addCookies([{ name: "ck_currency", value: "USD", url: SITE }]);
  await atWidths(page, `${SITE}/products/${SLUG}`, async () => {
    if (usd.length === 0) await expect(page.getByText(`$${expected}`).first()).toBeVisible();
    else await expect(page.getByText(/\$\s?[\d,]+\.\d{2}/).first()).toBeVisible();
  });
  issues.assertClean();
});
