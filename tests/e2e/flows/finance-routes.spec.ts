/**
 * BUG-047: /admin/finance, /admin/finance/payouts, /admin/finance/invoices had no page and
 * 404'd. They now redirect to the sub-pages that superseded them (ledger / partners / reports).
 */
import { expect, test } from "@playwright/test";

const ADMIN = "http://admin.localhost:3000";
const PW = "local-super-admin-passphrase-2026";
const CEO = "yashbank2002@gmail.com";

test("legacy /admin/finance routes redirect instead of 404ing", async ({ page }) => {
  await page.goto(`${ADMIN}/auth/login`);
  await page.getByLabel("Email").fill(CEO);
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/);

  await page.goto(`${ADMIN}/admin/finance`);
  await expect(page).toHaveURL(/\/admin\/finance\/ledger$/);

  await page.goto(`${ADMIN}/admin/finance/payouts`);
  await expect(page).toHaveURL(/\/admin\/finance\/partners$/);

  await page.goto(`${ADMIN}/admin/finance/invoices`);
  await expect(page).toHaveURL(/\/admin\/finance\/reports$/);
});
