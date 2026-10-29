/**
 * P14-02: creating an admin / staff / partner. Submit buttons show a spinner and cannot double
 * submit, the new row/card appears at once (optimistic) with a success animation + toast, and an
 * admin added as partner shows in the partner list and in the split picker. Server actions are
 * slowed so the pending state is observable. Fixture rows carry a unique tag and are removed after.
 */
import { expect, test } from "@playwright/test";

import { ADMIN, atWidths, expectNoOverflow, loginAs, q, trackIssues } from "./helpers";

const TAG = `p1402${Date.now()}`;
const staffEmail = `${TAG}-staff@example.com`;
const adminEmail = `${TAG}-admin@example.com`;
const partnerEmail = `${TAG}-partner@example.com`;
const partnerName = `${TAG} Partner`;
const USERS = `${ADMIN}/admin/admin-users`;
const PARTNERS = `${ADMIN}/admin/finance/partners`;

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "admin screens are laptop-only (LaptopNotice below lg)");

async function slowPosts(page: import("@playwright/test").Page, url: RegExp) {
  await page.route(url, async (route) => {
    if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
}

async function seedAdmin(email: string): Promise<string> {
  const [u] = await q<{ id: string }>(
    `insert into users (email, name, status, email_verified) values ($1, $2, 'active', true) returning id`,
    [email, email.split("@")[0]],
  );
  await q(`insert into user_roles (user_id, role_key) values ($1, 'admin')`, [u!.id]);
  return u!.id;
}

test.afterAll(async () => {
  const ids = (
    await q<{ id: string }>(`select id from users where email like $1`, [`${TAG}%`])
  ).map((r) => r.id);
  const reqs = (
    await q<{ id: string }>(`select id from approval_requests where payload->>'email' like $1`, [
      `${TAG}%`,
    ])
  ).map((r) => r.id);
  for (const id of reqs) {
    await q(`delete from notifications where payload::text like $1 or link like $1`, [`%${id}%`]);
    await q(`delete from approval_decisions where request_id=$1`, [id]);
    await q(`delete from approval_requests where id=$1`, [id]);
  }
  for (const id of ids) {
    await q(`delete from partners where user_id=$1`, [id]);
    await q(`delete from user_roles where user_id=$1`, [id]);
    await q(`delete from users where id=$1`, [id]).catch(() => undefined);
  }
});

test("invite staff and admin: spinner, row at once, success animation, one request each", async ({
  page,
}) => {
  const issues = trackIssues(page, [/429/]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAs(page, "super_admin");
  await page.goto(USERS);
  await slowPosts(page, /\/admin\/admin-users/);

  for (const [email, role] of [
    [staffEmail, /^Staff/],
    [adminEmail, /^Admin/],
  ] as const) {
    await page.getByRole("button", { name: /Invite admin/ }).click();
    const dlg = page.getByRole("dialog");
    await dlg.locator("#inv-email").fill(email);
    await dlg.getByRole("radio", { name: role }).click();
    const submit = dlg.getByRole("button", { name: "Request approval" });
    await submit.dblclick(); // double click must still create exactly one request
    await expect(submit).toHaveAttribute("aria-busy", "true");
    await expect(submit).toBeDisabled();
    const row = page.locator("tr", { hasText: email });
    await expect(row).toBeVisible(); // optimistic row, before the server answers
    await expect(row).toContainText("Saving…");
    await expect(dlg.getByTestId("success-mark")).toBeVisible();
    await expect(page.getByText("Invite approval requested").first()).toBeVisible();
    await expect(dlg).toBeHidden();
    await expect(row).toBeVisible();
    await expect(row).not.toContainText("Saving…"); // reconciled with the server row
    await expect(page.locator("tr", { hasText: email })).toHaveCount(1);
    const [cnt] = await q<{ n: string }>(
      `select count(*)::text as n from approval_requests where type='admin.user_change' and payload->>'email'=$1`,
      [email],
    );
    expect(cnt!.n).toBe("1");
  }
  issues.assertClean();
});

test("a failed invite rolls the optimistic row back with an error toast", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAs(page, "super_admin");
  await page.goto(USERS);
  const bad = `${TAG}-bad@example.com`;
  await page.route(/\/admin\/admin-users/, async (route) => {
    if (route.request().method() === "POST") return route.abort();
    return route.continue();
  });
  await page.getByRole("button", { name: /Invite admin/ }).click();
  const dlg = page.getByRole("dialog");
  await dlg.locator("#inv-email").fill(bad);
  await dlg.getByRole("button", { name: "Request approval" }).click();
  await expect(page.locator("tr", { hasText: bad })).toHaveCount(0, {
    timeout: 15_000,
  });
});

test("admin added as partner: card at once, one row, listed, in the split picker", async ({
  page,
}) => {
  const issues = trackIssues(page, [/429/]);
  const userId = await seedAdmin(partnerEmail); // stands in for an approved admin invite
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAs(page, "super_admin");
  await page.goto(PARTNERS);
  await slowPosts(page, /\/admin\/finance\/partners/);

  await page
    .getByRole("button", { name: /Add partner/ })
    .first()
    .click();
  const dlg = page.getByRole("dialog");
  await dlg.locator("#ap-email").fill(partnerEmail);
  await dlg.locator("#ap-name").fill(partnerName);
  const submit = dlg.getByRole("button", { name: "Add partner" });
  await submit.dblclick();
  await expect(submit).toHaveAttribute("aria-busy", "true");
  const card = page.locator(`section[aria-label="${partnerName} balance"]`);
  await expect(card).toBeVisible(); // optimistic card
  await expect(dlg.getByTestId("success-mark")).toBeVisible();
  await expect(page.getByText(`${partnerName} added as a partner`).first()).toBeVisible();
  await expect(dlg).toBeHidden();
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("button", { name: "Record payout" })).toBeEnabled();
  const [cnt] = await q<{ n: string }>(
    `select count(*)::text as n from partners where user_id=$1 and active`,
    [userId],
  );
  expect(cnt!.n).toBe("1");

  // survives a reload (server list) and is selectable in the ownership split picker
  await page.goto(PARTNERS);
  await expect(page.locator(`section[aria-label="${partnerName} balance"]`)).toBeVisible();
  const [prod] = await q<{ id: string }>(
    `select p.id from products p where not exists (select 1 from product_ownerships o where o.product_id=p.id and o.status='pending') order by p.created_at limit 1`,
  );
  await page.goto(`${ADMIN}/admin/products/${prod!.id}`);
  await page.getByRole("tab", { name: /Ownership/ }).click();
  await page.getByRole("button", { name: "Propose new split" }).click();
  await page.getByRole("button", { name: "Add partner" }).click();
  await page.locator('[id^="own-partner-"]').last().click();
  await expect(page.getByRole("option", { name: partnerName })).toBeVisible();
  issues.assertClean();
});

test("Make partner row action on the users screen", async ({ page }) => {
  const email = `${TAG}-second@example.com`;
  await seedAdmin(email);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAs(page, "super_admin");
  await page.goto(USERS);
  await page
    .getByLabel("Name or email…")
    .fill(email)
    .catch(() => undefined);
  const row = page.locator("tr", { hasText: email });
  await row.getByRole("button", { name: /Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Make partner" }).click();
  await expect(page.getByText(/added as a partner/).first()).toBeVisible();
  await expect(row).toContainText("active shares");
});

test("admin pages: LaptopNotice at 375/768, full screen at 1280", async ({ page }) => {
  await loginAs(page, "super_admin");
  for (const url of [USERS, PARTNERS]) {
    await atWidths(page, url, async (w) => {
      if (w < 1024) await expect(page.getByText(/designed for laptops/)).toBeVisible();
      else await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(USERS);
  await expectNoOverflow(page);
});
