/**
 * G18-1: login routing. Admin-class roles (super_admin, admin, staff) end up in the ADMIN area and
 * never in the customer area; customers keep the customer area and cannot enter admin.
 * Email + password stands in for Google here: /auth/post-login is the page Google's callback
 * lands on, and it is opened directly as well (the unit test proves the Google button uses it).
 */
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, PASSWORD, ROLE_EMAILS, SITE, formLogin, q } from "./helpers";

test.describe.configure({ mode: "serial" });

/** A server redirect to the other host can abort the first navigation; the redirect chain is what we assert. */
async function gotoQuiet(page: Page, url: string): Promise<void> {
  await page.goto(url).catch(() => undefined);
}

const adminHost = new URL(ADMIN).host;
const siteHost = new URL(SITE).host;

for (const role of ["super_admin", "admin", "staff"] as const) {
  test(`[${role}] lands in admin, and the customer area is closed`, async ({ page }) => {
    await formLogin(page, SITE, ROLE_EMAILS[role]);
    // Email sign-in on the site host hands the user to the admin host.
    await page.waitForURL((u) => u.host === adminHost && /dashboard/.test(u.pathname), {
      timeout: 30_000,
    });

    // The site-host session exists too (as after Google): the customer area must still refuse.
    await gotoQuiet(page, `${SITE}/account`);
    await page.waitForURL((u) => u.host === adminHost && /dashboard/.test(u.pathname), {
      timeout: 30_000,
    });

    // Google's landing page sends the same user to admin as well.
    await gotoQuiet(page, `${SITE}/auth/post-login?next=/account`);
    await page.waitForURL((u) => u.host === adminHost && /dashboard/.test(u.pathname), {
      timeout: 30_000,
    });
  });
}

test("[customer] keeps the customer area", async ({ page }) => {
  await formLogin(page, SITE, ROLE_EMAILS.customer);
  await expect(page).toHaveURL(/\/account/);
  expect(new URL(page.url()).host).toBe(siteHost);

  // The shared landing page honours the requested customer page and never leaves the site host.
  await page.goto(`${SITE}/auth/post-login?next=/account/wishlist`);
  await expect(page).toHaveURL(/\/account\/wishlist/);
  expect(new URL(page.url()).host).toBe(siteHost);

  // An open-redirect style next is ignored.
  await page.goto(`${SITE}/auth/post-login?next=//evil.example`);
  expect(new URL(page.url()).host).toBe(siteHost);
});

test("[customer] cannot enter admin", async ({ page }) => {
  // No admin session from the site cookie: the admin host sends the visitor to sign in.
  await formLogin(page, SITE, ROLE_EMAILS.customer);
  await page.goto(`${ADMIN}/dashboard`);
  await expect(page).toHaveURL(/\/auth\/login/);

  // Signing in to admin with customer credentials is refused.
  await q(`delete from rate_limit_buckets`);
  await page.getByLabel("Email").fill(ROLE_EMAILS.customer);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  const btn = page.getByRole("button", { name: "Sign in", exact: true });
  await expect(btn).toBeEnabled({ timeout: 20_000 });
  await btn.click();
  const alert = page.locator("form [role=alert]").first();
  await expect(alert).toBeVisible();
  // The sign-in endpoint allows only a few tries per 10 seconds: wait it out once and retry.
  if (/too many/i.test((await alert.textContent()) ?? "")) {
    await page.waitForTimeout(11_000);
    await btn.click();
  }
  await expect(page.locator("form [role=alert]").first()).toContainText(/admin access/i);
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("signed-out visitors are sent to sign in, not admin or account", async ({ page }) => {
  await page.goto(`${SITE}/auth/post-login`);
  await expect(page).toHaveURL(/\/auth\/login/);
  await page.goto(`${SITE}/account`);
  await expect(page).toHaveURL(/\/auth\/login/);
});
