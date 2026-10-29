/**
 * P14-03: notifications. Click opens the target item, popup closes on navigation / outside click and
 * never blocks the page, read state persists across pages and reloads, admin sidebar approvals badge
 * equals the pending approvals count. Fixture rows carry a unique tag and are removed afterwards.
 */
import { expect, test, type Page } from "@playwright/test";

import { ADMIN, SITE, WIDTHS, expectNoOverflow, loginAs, q, trackIssues } from "./helpers";

const TAG = `P1403-${Date.now()}`;
const ids = { buyer: "", admin: "", query: "", approval: "" };

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ids.buyer = (
    await q<{ id: string }>(`select id from users where email='buyer@codekraft.test'`)
  )[0]!.id;
  ids.admin = (
    await q<{ id: string }>(`select id from users where email='admin@codekraft.test'`)
  )[0]!.id;
  ids.query = (
    await q<{ id: string }>(
      `insert into queries (user_id, subject, source) values ($1, $2, 'form') returning id`,
      [ids.buyer, `${TAG} query`],
    )
  )[0]!.id;
  ids.approval = (
    await q<{ id: string }>(
      `insert into approval_requests (type, subject_type, subject_id, payload, requested_by, status)
       values ('site.reset', 'site', gen_random_uuid(), '{"categories":["leads"]}'::jsonb,
               (select id from users where email='yashbank2002@gmail.com'), 'pending') returning id`,
    )
  )[0]!.id;
});

test.afterAll(async () => {
  await q(`delete from notifications where title like $1`, [`${TAG}%`]);
  await q(`delete from approval_requests where id=$1`, [ids.approval]);
  await q(`delete from queries where id=$1`, [ids.query]);
});

async function seed(
  userId: string,
  name: string,
  link: string,
): Promise<{ id: string; title: string }> {
  const title = `${TAG} ${name}`;
  const [row] = await q<{ id: string }>(
    `insert into notifications (user_id, type, title, body, link, payload, channel_state)
     values ($1, 'query.replied', $2, 'body', $3, '{}'::jsonb, '{"inapp":"sent"}'::jsonb) returning id`,
    [userId, title, link],
  );
  return { id: row!.id, title };
}

const readAt = async (id: string) =>
  (await q<{ read_at: Date | null }>(`select read_at from notifications where id=$1`, [id]))[0]!
    .read_at;

/** Nothing may be left over a navigated page: no popup, no scroll-lock / pointer-events block. */
async function expectPageFree(page: Page) {
  await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0);
  const blocked = await page.evaluate(
    () =>
      getComputedStyle(document.body).pointerEvents === "none" ||
      document.querySelector('[data-aria-hidden="true"]') !== null,
  );
  expect(blocked).toBe(false);
}

for (const width of WIDTHS) {
  test(`[customer] @${width}: bell item opens target, popup closes, read persists`, async ({
    page,
  }) => {
    const issues = trackIssues(page, [/429/]);
    await page.setViewportSize({ width, height: 900 });
    const n = await seed(ids.buyer, `reply ${width}`, `/account/queries/${ids.query}`);
    const other = await seed(ids.buyer, `other ${width}`, `/account/settings`);
    await loginAs(page, "customer");
    await page.goto(`${SITE}/account`);
    await expectNoOverflow(page);

    const bell = page.getByRole("button", { name: /^Notifications, \d+ unread/ });
    await bell.click();
    await page
      .locator('[data-slot="popover-content"]')
      .getByRole("link", { name: new RegExp(n.title) })
      .click();
    await expect(page).toHaveURL(new RegExp(`/account/queries/${ids.query}$`));
    await expectPageFree(page);
    expect(await readAt(n.id)).not.toBeNull();
    expect(await readAt(other.id)).toBeNull();

    // Page is clickable: the bell reopens, an outside click closes it.
    await bell.click();
    await expect(page.locator('[data-slot="popover-content"]')).toBeVisible();
    // Radix arms its outside-click listener one tick after opening, so retry a click that races it.
    await expect(async () => {
      await page.mouse.click(2, 880);
      await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0, { timeout: 1000 });
    }).toPass({ timeout: 10_000 });

    // Later visits never resurface the read item as unread.
    for (const path of ["/account", "/account/notifications"]) {
      await page.goto(`${SITE}${path}`);
      await page.reload();
      await bell.click();
      const pop = page.locator('[data-slot="popover-content"]');
      await expect(pop.getByRole("link", { name: new RegExp(n.title) })).not.toContainText(
        "(unread)",
      );
      await expect(pop.getByRole("link", { name: new RegExp(other.title) })).toContainText(
        "(unread)",
      );
      await page.keyboard.press("Escape");
    }
    issues.assertClean();
  });
}

test("[admin] @1280: bell + inbox open targets, popup closes, read persists, sidebar badge", async ({
  page,
}) => {
  const issues = trackIssues(page, [/429/]);
  await page.setViewportSize({ width: 1280, height: 900 });
  const nq = await seed(ids.admin, "admin query", `/admin/queries/${ids.query}`);
  const na = await seed(ids.admin, "admin approval", `/admin/approvals?id=${ids.approval}`);
  const nbox = await seed(ids.admin, "admin inbox", `/admin/queries/${ids.query}`);
  await loginAs(page, "admin");
  await page.goto(`${ADMIN}/admin/dashboard`);

  // Sidebar badge == pending approvals in the DB.
  const pending = (
    await q<{ n: number }>(
      `select count(*)::int as n from approval_requests where status='pending'`,
    )
  )[0]!.n;
  const nav = page.locator('aside[aria-label="Admin navigation"]');
  const badge = nav
    .locator("li")
    .filter({ has: page.getByRole("link", { name: "Approvals", exact: true }) })
    .locator('[data-sidebar="menu-badge"]');
  await expect(badge).toHaveText(new RegExp(`^${pending}\\s*pending approvals`));

  const bell = page.getByRole("button", { name: /^Notifications, \d+ unread/ });
  await bell.click();
  await page
    .locator('[data-slot="popover-content"]')
    .getByRole("link", { name: new RegExp(nq.title) })
    .click();
  await expect(page).toHaveURL(new RegExp(`/admin/queries/${ids.query}$`));
  await expectPageFree(page);
  expect(await readAt(nq.id)).not.toBeNull();

  await bell.click();
  await page
    .locator('[data-slot="popover-content"]')
    .getByRole("link", { name: new RegExp(na.title) })
    .click();
  await expect(page).toHaveURL(new RegExp(`/admin/approvals\\?id=${ids.approval}$`));
  await expect(page.getByText("Reset site data").first()).toBeVisible();
  await expectPageFree(page);

  // Outside click closes the popup.
  await bell.click();
  await expect(page.locator('[data-slot="popover-content"]')).toBeVisible();
  await page.mouse.click(640, 880);
  await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0);

  // Inbox page row opens its target; read items stay read on other pages and after reload.
  await page.goto(`${ADMIN}/admin/notifications`);
  await page.getByRole("link", { name: new RegExp(nbox.title) }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/queries/${ids.query}$`));
  expect(await readAt(nbox.id)).not.toBeNull();
  for (const path of ["/admin/dashboard", "/admin/notifications"]) {
    await page.goto(`${ADMIN}${path}`);
    await page.reload();
    await bell.click();
    await expect(
      page
        .locator('[data-slot="popover-content"]')
        .getByRole("link", { name: new RegExp(nq.title) }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  issues.assertClean();
});
