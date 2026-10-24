/**
 * Admin product editor Versions tab (BUG-043): "Add version" is a real form backed by
 * `createProductVersionAction`, not a disabled control. Create a product, add a version with a
 * semver string and structured changelog, save, and confirm the row appears in the list — both
 * immediately (merged into local state) and after a reload (actually persisted server-side).
 */
import { expect, test } from "@playwright/test";

const ADMIN = "http://admin.localhost:3000";
const PW = "local-super-admin-passphrase-2026";
const CEO = "yashbank2002@gmail.com";

test("add a product version with changelog and confirm it appears in the list on reload", async ({
  page,
}) => {
  await page.goto(`${ADMIN}/auth/login`);
  await page.getByLabel("Email").fill(CEO);
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/);

  await page.goto(`${ADMIN}/admin/products`);
  await page.getByRole("link", { name: /new product/i }).click();
  const name = `E2E Version Probe ${Date.now()}`;
  await page.getByRole("textbox", { name: "Name" }).first().fill(name);
  await page
    .getByRole("textbox", { name: /short description/i })
    .fill("E2E version probe product.");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}/);

  await page.getByText("Versions", { exact: true }).click();
  const version = "1.2.0";
  await page.getByTestId("version-input").fill(version);
  await page.getByTestId("version-summary").fill("Probe release summary.");
  await page.getByTestId("version-added").fill("New probe feature");
  await page.getByTestId("add-version-submit").click();
  await expect(page.getByText("Version added")).toBeVisible();
  await expect(page.getByText(version, { exact: true })).toBeVisible();

  await page.reload();
  await page.getByText("Versions", { exact: true }).click();
  await expect(page.getByText(version, { exact: true })).toBeVisible();
  await expect(page.getByText("Probe release summary.")).toBeVisible();
});
