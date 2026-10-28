/**
 * P3-03: admin case studies add -> edit -> publish, then the study shows on the public /projects page.
 * LOCAL ONLY (localhost DB + dev server).
 */
import { expect, test } from "@playwright/test";

const SITE = process.env.E2E_SITE_URL ?? "http://localhost:3000";
const ADMIN = process.env.E2E_ADMIN_URL ?? "http://admin.localhost:3000";
const PW = "local-super-admin-passphrase-2026";
const CEO = "yashbank2002@gmail.com";

test("create, edit and publish a case study; it appears on /projects", async ({ page }) => {
  const stamp = Date.now();
  const title = `E2E Case Study ${stamp}`;
  const edited = `${title} edited`;

  await page.goto(`${ADMIN}/auth/login`);
  await page.getByLabel("Email").fill(CEO);
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/);

  await page.goto(`${ADMIN}/admin/content/case-studies`);
  await page.getByRole("button", { name: /new case study/i }).click();
  await page.locator("#cs-title").fill(title);
  await page.locator("#cs-slug").fill(`e2e-cs-${stamp}`);
  await page.locator("#cs-industry").fill("Fintech");
  await page.locator("#cs-problem").fill("The problem.");
  await page.locator("#cs-solution").fill("The solution.");
  await page.locator("#cs-results").fill("The results.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Case study saved")).toBeVisible();

  // The new row becomes the open editor (no reload) so edit + publish act on it, not a duplicate.
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.locator("#cs-title").fill(edited);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: edited })).toBeVisible();

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText(/Published — live at/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();

  await page.goto(`${SITE}/projects`);
  await expect(page.getByText(edited).first()).toBeVisible();
});
