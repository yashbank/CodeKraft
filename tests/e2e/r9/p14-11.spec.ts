/**
 * P14-11: UX sweep. Overlays close on Escape (focus returns) and on route change, redirects stay
 * same-site, the leads "Set priority" button works and the list shows the new state without a
 * reload, and creating an approval notifies the deciding admins (`approval.requested`).
 * Fixture rows carry a unique tag and are removed after.
 */
import { expect, test } from "@playwright/test";

import { ADMIN, SITE, atWidths, expectNoOverflow, loginAs, q, trackIssues } from "./helpers";

const TAG = `p1411${Date.now()}`;
const LEAD_NAME = `${TAG} Lead`;
const inviteEmail = `${TAG}-admin@example.com`;

test.beforeAll(async () => {
  await q(`insert into leads (source, name, email) values ('manual', $1, $2)`, [
    LEAD_NAME,
    `${TAG}@example.com`,
  ]);
});

test.afterAll(async () => {
  await q(`delete from lead_activities where lead_id in (select id from leads where name=$1)`, [
    LEAD_NAME,
  ]);
  await q(`delete from leads where name=$1`, [LEAD_NAME]);
  const reqs = await q<{ id: string }>(
    `select id from approval_requests where payload->>'email' = $1`,
    [inviteEmail],
  );
  for (const { id } of reqs) {
    await q(`delete from notifications where link like $1`, [`%${id}%`]);
    await q(`delete from approval_decisions where request_id=$1`, [id]);
    await q(`delete from approval_requests where id=$1`, [id]);
  }
  await q(`delete from user_roles where user_id in (select id from users where email=$1)`, [
    inviteEmail,
  ]);
  await q(`delete from users where email=$1`, [inviteEmail]).catch(() => undefined);
});

test("site menu drawer: Escape closes it and returns focus; a route change closes it", async ({
  page,
}) => {
  const issues = trackIssues(page, [/429/]);
  for (const w of [375, 768]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(SITE);
    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
    // Client-side route change while open (back/forward, programmatic push): must not survive.
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.evaluate(() =>
      (window as unknown as { next: { router: { push(u: string): void } } }).next.router.push(
        "/products",
      ),
    );
    await expect(page).toHaveURL(/\/products/);
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked", /.+/);
    await expectNoOverflow(page);
  }
  issues.assertClean();
});

test("signed-out visit to an account page returns to it after sign-in; hostile next is inert", async ({
  page,
}) => {
  await atWidths(page, `${SITE}/account/purchases`, async () => {
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Faccount%2Fpurchases/);
  });
  for (const hostile of [
    "//evil.example.com",
    "/%5Cevil.example.com",
    "https://evil.example.com",
  ]) {
    await page.goto(`${SITE}/auth/login?next=${encodeURIComponent(hostile)}`);
    await expect(page.getByLabel("Email")).toBeVisible();
    expect(new URL(page.url()).hostname).toBe(new URL(SITE).hostname);
  }
});

test("admin handoff never leaves the admin host, even for a backslash next", async ({ page }) => {
  await page.route("**/api/auth/one-time-token/verify", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.goto(
    `${ADMIN}/auth/handoff?token=t&next=${encodeURIComponent("/\\evil.example.com")}`,
  );
  await page.waitForURL(/\/auth\/login/);
  expect(new URL(page.url()).hostname).toBe(new URL(ADMIN).hostname);
});

test.describe("admin (1280)", () => {
  test.skip(({ isMobile }) => isMobile, "admin screens are laptop-only (LaptopNotice below lg)");

  test("leads: Set priority updates selected rows and the table without reload; filters work", async ({
    page,
  }) => {
    const issues = trackIssues(page, [/429/]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, "admin");
    await page.goto(`${ADMIN}/admin/leads`);
    await page.getByRole("searchbox").fill(TAG);
    const row = page.locator("tr", { hasText: LEAD_NAME });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Normal");

    await row.getByRole("checkbox", { name: `Select ${LEAD_NAME}` }).check();
    await page.getByRole("button", { name: "Set priority" }).click();
    await page.getByRole("menuitem", { name: "High" }).click();
    await expect(row).toContainText("High"); // no page reload
    const rows = await q<{ priority: string }>(`select priority from leads where name=$1`, [
      LEAD_NAME,
    ]);
    expect(rows[0]?.priority).toBe("high");

    // Priority filter is wired: Low hides the High lead, High shows it again.
    await page.getByLabel("Priority").click();
    await page.getByRole("option", { name: "Low" }).click();
    await expect(row).toHaveCount(0);
    await page.getByLabel("Priority").click();
    await page.getByRole("option", { name: "High" }).click();
    await expect(row).toHaveCount(1);
    issues.assertClean();
  });

  test("notification bell: Escape closes the popup and returns focus", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, "admin");
    await page.goto(`${ADMIN}/admin/leads`);
    const bell = page.getByRole("button", { name: /notifications/i }).first();
    await bell.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(bell).toBeFocused();
  });

  test("requesting an approval notifies the other admins (approval.requested)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, "super_admin");
    await page.goto(`${ADMIN}/admin/admin-users`);
    await page.getByRole("button", { name: /Invite admin/ }).click();
    const dlg = page.getByRole("dialog");
    await dlg.locator("#inv-email").fill(inviteEmail);
    await dlg.getByRole("radio", { name: /^Admin/ }).click();
    await dlg.getByRole("button", { name: "Request approval" }).click();
    await expect(dlg).toBeHidden();
    await expect
      .poll(async () => {
        const rows = await q<{ link: string; email: string }>(
          `select n.link, u.email from notifications n
             join users u on u.id = n.user_id
            where n.type = 'approval.requested'
              and n.link like '/admin/approvals?id=%'
              and n.link like '%' || (select id::text from approval_requests where payload->>'email' = $1 limit 1)`,
          [inviteEmail],
        );
        return rows.map((r) => r.email);
      })
      .toContain("admin@codekraft.test");
  });
});

test("admin shows the laptop notice below 1024 without overflow", async ({ page }) => {
  await loginAs(page, "admin");
  for (const w of [375, 768]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(`${ADMIN}/admin/leads`);
    await expect(page.getByText(/designed for laptops/i)).toBeVisible();
    await expectNoOverflow(page);
  }
});
