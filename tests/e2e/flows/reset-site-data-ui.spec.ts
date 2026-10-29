/** P7-01: Reset site data UI only; never clicks Request. LOCAL ONLY. */
import { expect, test } from "@playwright/test";

const ADMIN = process.env.E2E_ADMIN_URL ?? "http://admin.localhost:3000";
const PW = "local-super-admin-passphrase-2026";
const CEO = "yashbank2002@gmail.com";

for (const width of [375, 768, 1280]) {
  test(`reset UI at ${width}px: independent ticks, enabled Request`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${ADMIN}/auth/login`);
    await page.getByLabel("Email").fill(CEO);
    await page.getByLabel("Password").fill(PW);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/auth\/login/);

    await page.goto(`${ADMIN}/admin/settings`);
    await page
      .getByRole("button", { name: /danger/i })
      .first()
      .click();
    await page.getByRole("checkbox", { name: /customers/i }).click();
    await expect(page.locator('[role="checkbox"][aria-checked="true"]')).toHaveCount(1);
    await expect(page.getByText(/Also removed because they depend on it/i)).toBeVisible();

    await page.getByRole("button", { name: /download backup/i }).click();
    await expect(page.getByText("Backup downloaded")).toBeVisible();
    const name = await page.locator("label[for=reset-confirm] strong").innerText();
    await page.locator("#reset-confirm").fill(name);
    await expect(page.getByRole("button", { name: /request site reset/i })).toBeEnabled();
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(fits).toBe(true);
    // Deliberately not clicking Request.
  });
}
