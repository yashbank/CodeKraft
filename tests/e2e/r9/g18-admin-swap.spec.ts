/**
 * G18: swapping the super admins safely, end to end in the browser (local DB only).
 *
 * Two throw-away "old" super admins are created and every other admin-class user is suspended for
 * the run (restored afterwards), so the approver set is exactly the people this spec controls.
 * Flow: old A invites two new super admins (crestline.technologies.in) and a partner admin
 * (info@crestline.technologies.in); the Approvals screen names who must approve; old B approves;
 * removing an old super admin is refused while the new ones have never signed in; after they sign
 * in the Admin users list shows them verified and the removal goes through; both old ones go.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN, ROLE_EMAILS, formLogin, q } from "./helpers";

const stamp = Date.now();
const OLD_A = `g18-old-a-${stamp}@example.test`;
const OLD_B = `g18-old-b-${stamp}@example.test`;
const NEW_A = `g18-new-a-${stamp}@crestline.technologies.in`;
const NEW_B = `g18-new-b-${stamp}@crestline.technologies.in`;
const PARTNER = "info@crestline.technologies.in";

let suspended: { id: string; status: string }[] = [];

async function createSuper(email: string, name: string): Promise<string> {
  const [u] = await q<{ id: string }>(
    `insert into users (email, name, email_verified) values ($1, $2, true) returning id`,
    [email, name],
  );
  await q(`insert into user_roles (user_id, role_key) values ($1, 'super_admin')`, [u!.id]);
  return u!.id;
}

/** Give a user the seeded password, as if they had finished the invite link. */
async function giveSeededPassword(userId: string) {
  await q(
    `insert into accounts (user_id, account_id, provider_id, password)
     select $1::uuid, $3::text, 'credential', a.password from accounts a
     join users u on u.id = a.user_id
     where u.email = $2 and a.provider_id = 'credential' limit 1`,
    [userId, ROLE_EMAILS.super_admin, userId],
  );
}

async function signedInPage(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await formLogin(page, ADMIN, email);
  return page;
}

/**
 * Approve everything waiting for this person through the real Approvals screen. Requests they
 * already approved stay in "For my approval" until they apply, so walk the whole list.
 */
async function approveAllPending(page: Page) {
  await page.goto(`${ADMIN}/admin/approvals`);
  await page.getByRole("tab", { name: /For my approval/ }).waitFor({ timeout: 30_000 });
  const items = page.locator('button[aria-controls="approval-detail"]');
  const approve = page.getByRole("button", { name: /^Approve:/ });
  let idx = 0;
  while (idx < (await items.count())) {
    await items.nth(idx).click();
    if (await approve.first().isVisible()) {
      await approve.first().click();
      await expect(page.getByText(/Approved and applied|Approval recorded/).first()).toBeVisible({
        timeout: 20_000,
      });
      await page.waitForTimeout(1_500);
      idx = 0; // the list re-reads from the server and may shrink: start over
    } else {
      idx++;
    }
  }
}

async function invite(page: Page, email: string, role: RegExp, partnerName?: string) {
  await page.goto(`${ADMIN}/admin/admin-users`);
  await page.getByRole("button", { name: "Invite admin" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByRole("radio", { name: role }).click();
  if (partnerName) {
    await dialog.getByLabel("Also a partner").click();
    await dialog.getByLabel("Partner display name").fill(partnerName);
  }
  await dialog.getByRole("button", { name: "Request approval" }).click();
  await expect(page.getByText("Invite approval requested").first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

async function requestRemoval(page: Page, name: string) {
  await page.goto(`${ADMIN}/admin/admin-users`);
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Delete account…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Request approval" }).click();
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  suspended = await q<{ id: string; status: string }>(
    `select distinct u.id, u.status::text as status from users u
     join user_roles r on r.user_id = u.id
     where r.role_key in ('super_admin','admin','staff') and u.status = 'active'`,
  );
  await q(`update users set status = 'suspended' where id = any($1::uuid[])`, [
    suspended.map((s) => s.id),
  ]);
  // A leftover partner admin from an earlier run would be reused by the invite; start clean.
  await q(`delete from partners where user_id in (select id from users where email = $1)`, [
    PARTNER,
  ]);
  await q(`delete from users where email = $1`, [PARTNER]);
  // Pending invites left by an interrupted earlier run would add approvers; close them.
  await q(
    `update approval_requests set status = 'cancelled'
     where status = 'pending' and type = 'admin.user_change'`,
  );
  await createSuper(OLD_A, "G18 Old A");
  const b = await createSuper(OLD_B, "G18 Old B");
  await q(`insert into partners (user_id, display_name, active) values ($1, 'G18 Old B', true)`, [
    b,
  ]);
  for (const e of [OLD_A, OLD_B]) {
    const [u] = await q<{ id: string }>(`select id from users where email = $1`, [e]);
    await giveSeededPassword(u!.id);
  }
});

test.afterAll(async () => {
  // Put the shared local data back the way it was.
  const mine = [OLD_A, OLD_B, NEW_A, NEW_B, PARTNER];
  await q(
    `delete from user_roles where user_id in (select id from users where email = any($1::text[]))`,
    [mine],
  );
  await q(`update users set status = 'suspended' where email = any($1::text[])`, [mine]);
  await q(`update users set status = 'active' where id = any($1::uuid[])`, [
    suspended.map((s) => s.id),
  ]);
});

test("invite, see approvers, refuse while unverified, verify, remove the old super admins", async ({
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "Admin users is a laptop screen");
  test.setTimeout(480_000);
  const idOf = async (email: string) =>
    (await q<{ id: string }>(`select id from users where email = $1`, [email]))[0]!.id;
  const gone = async (email: string) =>
    (await q(`select 1 from users where email = $1`, [email])).length === 0;
  const verificationRow = (p: Page, email: string) =>
    p.getByTestId("admin-verification").locator(`[data-email="${email}"]`);

  // 1. Old A invites the first new super admin. The Approvals screen names who must approve.
  const oldA = await signedInPage(browser, OLD_A);
  await invite(oldA, NEW_A, /Super Admin/);
  await oldA.goto(`${ADMIN}/admin/approvals`);
  await oldA.getByRole("tab", { name: /Requested by me/ }).click();
  const rows = oldA.getByTestId("approvers-panel").getByTestId("approver-row");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("G18 Old B");
  await expect(rows.first()).toContainText(OLD_B);
  await expect(rows.first()).toHaveAttribute("data-state", "pending");

  // 2. Old B approves; the new account exists but cannot sign in yet.
  const oldB = await signedInPage(browser, OLD_B);
  await approveAllPending(oldB);
  expect(await gone(NEW_A)).toBe(false);
  await oldA.goto(`${ADMIN}/admin/admin-users`);
  await expect(verificationRow(oldA, NEW_A)).toHaveAttribute("data-verified", "no");
  await expect(verificationRow(oldA, NEW_A)).toContainText("Cannot sign in");
  await expect(verificationRow(oldA, NEW_A)).toContainText("Never signed in");

  // 3. Removing old B is refused: only one other super admin has a verified login.
  await requestRemoval(oldA, "G18 Old B");
  await expect(oldA.getByText(/must have a verified login/).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(oldA.getByText(/1 ready, 1 more needed/).first()).toBeVisible();
  await expect(oldA.getByText(NEW_A, { exact: false }).first()).toBeVisible();
  const queued = await q(
    `select 1 from approval_requests where payload->>'userId' = $1 and status = 'pending'`,
    [await idOf(OLD_B)],
  );
  expect(queued).toHaveLength(0);

  // 4. New A gets a password and signs in for real; the list now shows verified.
  await giveSeededPassword(await idOf(NEW_A));
  const newA = await signedInPage(browser, NEW_A);
  await oldA.goto(`${ADMIN}/admin/admin-users`);
  await expect(verificationRow(oldA, NEW_A)).toHaveAttribute("data-verified", "yes");
  await expect(verificationRow(oldA, NEW_A)).toContainText("Email verified");
  await expect(verificationRow(oldA, NEW_A)).toContainText("Sign-in: password");

  // 5. Old A invites the second new super admin: old B and new A are both listed as pending.
  await invite(oldA, NEW_B, /Super Admin/);
  await oldA.goto(`${ADMIN}/admin/approvals`);
  await oldA.getByRole("tab", { name: /Requested by me/ }).click();
  const two = oldA.getByTestId("approvers-panel").getByTestId("approver-row");
  await expect(two).toHaveCount(2);
  await expect(oldA.getByTestId("approvers-panel")).toContainText(NEW_A);
  await expect(oldA.getByTestId("approvers-panel")).toContainText(OLD_B);
  await approveAllPending(oldB);
  await approveAllPending(newA);
  expect(await gone(NEW_B)).toBe(false);

  // 6. New B signs in too.
  await giveSeededPassword(await idOf(NEW_B));
  const newB = await signedInPage(browser, NEW_B);
  await oldA.goto(`${ADMIN}/admin/admin-users`);
  await expect(verificationRow(oldA, NEW_B)).toHaveAttribute("data-verified", "yes");

  // 7. Now removing old B works; the new super admins approve.
  await requestRemoval(oldA, "G18 Old B");
  await expect(oldA.getByText(/approval requested/i).first()).toBeVisible({ timeout: 20_000 });
  await approveAllPending(newA);
  await approveAllPending(newB);
  await expect.poll(() => gone(OLD_B), { timeout: 20_000 }).toBe(true);

  // 8. New A removes old A; new B approves. Only the two new super admins remain.
  await requestRemoval(newA, "G18 Old A");
  await expect(newA.getByText(/approval requested/i).first()).toBeVisible({ timeout: 20_000 });
  await approveAllPending(newB);
  await expect.poll(() => gone(OLD_A), { timeout: 20_000 }).toBe(true);
  const supers = await q<{ email: string }>(
    `select u.email from users u join user_roles r on r.user_id = u.id
     where r.role_key = 'super_admin' and u.status = 'active' order by u.email`,
  );
  expect(supers.map((s) => s.email)).toEqual([NEW_A, NEW_B].sort());

  // 9. The partner-only invite: info@crestline.technologies.in as an admin with a partner profile.
  await invite(newA, PARTNER, /^Admin/, "Crestline Technologies");
  await approveAllPending(newB);
  const [partnerRow] = await q<{ display_name: string; role_key: string }>(
    `select p.display_name, r.role_key from partners p
     join users u on u.id = p.user_id join user_roles r on r.user_id = u.id
     where u.email = $1`,
    [PARTNER],
  );
  expect(partnerRow).toEqual({ display_name: "Crestline Technologies", role_key: "admin" });
  await newA.goto(`${ADMIN}/admin/admin-users`);
  await expect(verificationRow(newA, PARTNER)).toContainText("Partner: yes");
});
