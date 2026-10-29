/** R9-01: Reset site data end to end on a LOCAL ck_* DB: request (A), approve (B + remaining admins), wipe. */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN, PASSWORD, ROLE_EMAILS, atWidths, loginAs, q, trackIssues } from "./helpers";

const B = "sanketshrikant42@gmail.com";
const SUPERS = [ROLE_EMAILS.super_admin, B];

async function signIn(page: Page, email: string) {
  // better-auth's in-memory limiter (sign-in: 3 per 10s per IP) is not the DB table; wait it out.
  for (let i = 0; i < 4; i++) {
    await page.goto(`${ADMIN}/auth/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const limited = page.getByText(/too many requests/i);
    await Promise.race([
      page.waitForURL((u) => !/\/auth\/login/.test(u.pathname), { timeout: 20_000 }),
      limited.waitFor({ timeout: 20_000 }),
    ]).catch(() => {});
    if (!(await limited.isVisible())) break;
    await page.waitForTimeout(11_000);
  }
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 20_000 });
}

async function openDanger(page: Page) {
  await page.goto(`${ADMIN}/admin/settings`);
  await page
    .getByRole("button", { name: /danger/i })
    .first()
    .click();
}

async function approveAs(browser: Browser, email: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, email);
  await page.goto(`${ADMIN}/admin/approvals`);
  await page.getByText("Reset site data").first().click();
  await page
    .getByRole("button", { name: /^approve/i })
    .first()
    .click({ noWaitAfter: true });
  await expect(page.getByText(/approved|applied|recorded/i).first()).toBeVisible();
  await ctx.close();
}

const statusOf = async (id: string) =>
  (await q<{ status: string }>(`select status from approval_requests where id = $1`, [id]))[0]!
    .status;

test("reset site data: request, second super admin approves, data wiped, admins kept", async ({
  browser,
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "admin Settings is laptop-only (>=1024px) by design; covered at 375/768 on desktop",
  );
  test.setTimeout(300_000);
  // Guard first: q() refuses any non-localhost DATABASE_URL, before anything is clicked.
  const before = (await q<{ n: number }>(`select count(*)::int n from products`))[0]!.n;
  expect(before).toBeGreaterThan(0);
  const keepUsers = (
    await q<{ id: string }>(`select id from users where email = any($1)`, [SUPERS])
  ).map((r) => r.id);
  expect(keepUsers).toHaveLength(2);

  const issues = trackIssues(page);
  await loginAs(page, "super_admin");
  await openDanger(page);
  const request = page.getByRole("button", { name: /request site reset/i });
  await expect(request).toBeDisabled();
  await expect(page.getByTestId("reset-blockers")).toContainText(/select/i);

  await page.getByRole("checkbox", { name: /products/i }).click();
  await page.getByRole("button", { name: /preview row counts/i }).click();
  await expect(page.getByLabel("Rows to delete")).toBeVisible();
  const name = await page.locator("label[for=reset-confirm] strong").innerText();
  await page.locator("#reset-confirm").fill(name);
  // Preview + name alone is not enough: the backup is required, and the UI says so.
  await expect(request).toBeDisabled();
  await expect(page.getByTestId("reset-blockers")).toContainText(/download the backup/i);
  await page.getByRole("button", { name: /download backup/i }).click();
  await expect(page.getByText("Backup downloaded")).toBeVisible();
  await expect(request).toBeEnabled();
  await request.click();
  await expect(page.getByText("Reset requested")).toBeVisible();

  const appr = (
    await q<{ id: string }>(
      `select id from approval_requests where type = 'site.reset' and status = 'pending' order by created_at desc limit 1`,
    )
  )[0]!;
  expect(appr.id).toBeTruthy();

  // B approves; then any other active admin-class user the approver set still owes.
  await approveAs(browser, B);
  const owedOf = () =>
    q<{ email: string }>(
      `select distinct u.email from users u join user_roles ur on ur.user_id = u.id
        where u.status = 'active' and ur.role_key in ('super_admin','admin')
          and u.id <> (select requested_by from approval_requests where id = $1)
          and u.id not in (select decided_by from approval_decisions where request_id = $1)`,
      [appr.id],
    );
  for (let i = 0; i < 4 && (await statusOf(appr.id)) === "pending"; i++) {
    const owed = await owedOf();
    expect(owed.length, "pending but nobody left to approve").toBeGreaterThan(0);
    const email = owed[0]!.email;
    await approveAs(browser, email);
    // The approve click returns before the action commits: wait for the decision to land.
    await expect
      .poll(async () => !(await owedOf()).some((o) => o.email === email), { timeout: 15_000 })
      .toBe(true);
  }
  await expect.poll(() => statusOf(appr.id)).toBe("applied");

  // The wipe really ran.
  for (const t of ["products", "orders", "leads"]) {
    const n = (await q<{ n: number }>(`select count(*)::int n from ${t}`))[0]!.n;
    expect(n, t).toBe(0);
  }
  // Both super admins and their roles survive.
  expect((await q(`select id from users where email = any($1)`, [SUPERS])).length).toBe(2);
  const roles = await q(
    `select 1 from user_roles where user_id = any($1) and role_key = 'super_admin'`,
    [keepUsers],
  );
  expect(roles.length).toBe(2);

  // Danger zone still renders and fits at every width after the wipe.
  await atWidths(page, `${ADMIN}/admin/settings`, async (w) => {
    if (w < 1024) {
      // Settings is deliberately laptop-only: below 1024px the app shows a notice instead.
      await expect(page.getByText(/designed for laptops/i)).toBeVisible();
      return;
    }
    await page
      .getByRole("button", { name: /danger/i })
      .first()
      .click();
    await expect(page.getByRole("button", { name: /request site reset/i })).toBeDisabled();
    await expect(page.getByTestId("reset-blockers")).toBeVisible();
  });
  issues.assertClean();
});
