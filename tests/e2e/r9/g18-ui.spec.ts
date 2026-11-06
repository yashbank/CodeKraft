/**
 * G18 admin UI polish, proven in a real browser at 375 / 768 / 1280:
 *  (3a) five admin lists show exactly ONE 3-dot menu per row (44px target, keyboard-openable,
 *       no inline Edit/Delete/Move buttons), and nothing scrolls sideways at any width;
 *  (3c) dashboard widget numbers equal the database, every widget carries an "Updated" caption,
 *       and the 60-second timer picks up rows added behind the page's back.
 * Admin screens below 1024px show the "open on a laptop" notice by design (docs/07 §3.4), so the
 * row checks run on the laptop width and the small widths prove the page still renders cleanly.
 */
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, atWidths, expectNoOverflow, loginAs, q, trackIssues } from "./helpers";

// The two groups insert and delete leads, so the whole file runs in order in one worker.
test.describe.configure({ mode: "serial" });

const INLINE_ACTION =
  /^(Edit|Delete|Remove|Copy|Claim|Move|Open order|Mark done|Deactivate|Activate)/;

async function expectOneMenuPerRow(page: Page) {
  const rows = page.locator("tbody tr");
  const total = await rows.count();
  expect(total, "list has rows to check").toBeGreaterThan(0);
  let checked = 0;
  for (let i = 0; i < Math.min(total, 8); i++) {
    const row = rows.nth(i);
    // Skip detail/expansion rows that hold a single full-width cell.
    if ((await row.locator("td").count()) < 2) continue;
    const menus = row.getByRole("button", { name: /^Actions for / });
    await expect(menus, `row ${i} has one menu`).toHaveCount(1);
    await expect(row.getByRole("button", { name: INLINE_ACTION })).toHaveCount(0);
    const box = await menus.boundingBox();
    expect(box?.width ?? 0, "touch target width").toBeGreaterThanOrEqual(43.5);
    expect(box?.height ?? 0, "touch target height").toBeGreaterThanOrEqual(43.5);
    checked++;
  }
  expect(checked, "rows with a menu").toBeGreaterThan(0);

  // Keyboard: focus the first trigger, Enter opens the menu, Escape closes it again.
  const trigger = page.getByRole("button", { name: /^Actions for / }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
}

const LISTS = [
  { name: "customers", path: "/admin/customers" },
  { name: "products", path: "/admin/products" },
  { name: "coupons", path: "/admin/coupons" },
  { name: "leads", path: "/admin/leads" },
  { name: "admin users", path: "/admin/admin-users" },
] as const;

test.describe("G18 3a: one 3-dot menu per row", () => {
  const stamp = Date.now();
  test.beforeAll(async () => {
    for (let i = 0; i < 3; i++)
      await q(
        `insert into leads (source, name, email, status) values ('inquiry_form', $1, $2, 'new')`,
        [`G18 lead ${i}`, `g18-${stamp}-${i}@example.test`],
      );
  });
  test.afterAll(async () => {
    await q(`delete from leads where email like $1`, [`g18-${stamp}-%@example.test`]);
  });

  for (const list of LISTS) {
    test(`${list.name}: kebab menu on every row at 375 / 768 / 1280`, async ({ page }) => {
      test.setTimeout(120_000);
      const issues = trackIssues(page);
      await loginAs(page, "super_admin");
      await atWidths(page, `${ADMIN}${list.path}`, async (w) => {
        if (w >= 1024) {
          await expectOneMenuPerRow(page);
        } else {
          // Laptop notice (or the list itself): either way the page has content and no sideways scroll.
          await expect(page.getByRole("heading").first()).toBeVisible();
          await expectNoOverflow(page);
        }
      });
      issues.assertClean();
    });
  }
});

test.describe("G18 3c: widgets match the database", () => {
  const stamp = Date.now();
  const insertLeads = async (n: number, tag: string) => {
    for (let i = 0; i < n; i++)
      await q(
        `insert into leads (source, name, email, status) values ('inquiry_form', $1, $2, 'new')`,
        [`G18 w ${tag}${i}`, `g18w-${stamp}-${tag}${i}@example.test`],
      );
  };
  test.beforeAll(async () => {
    // another spec (p14-09, p14-01...) may have saved a custom widget set for the admin: use the default
    await q(`delete from dashboard_layouts`);
  });
  test.afterAll(async () => {
    await q(`delete from leads where email like $1`, [`g18w-${stamp}-%@example.test`]);
  });

  const newLeadsText = (page: Page) =>
    page.locator('section[data-widget="new_leads"] div.tnum').first().innerText();
  const dbNewLeads = async () =>
    Number(
      (await q<{ c: string }>(`select count(*)::text as c from leads where status = 'new'`))[0]?.c,
    );

  test("values equal DB counts, captions show, refresh and the 60s timer update them", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const issues = trackIssues(page);
    await insertLeads(2, "a");
    await loginAs(page, "super_admin");
    await page.clock.install();

    for (const w of [375, 768, 1280] as const) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(`${ADMIN}/admin/dashboard`);
      await expectNoOverflow(page);
      const widgets = page.locator("section[data-widget]");
      expect(await widgets.count()).toBeGreaterThan(0);
      // every widget has an "Updated ..." caption
      await expect(page.locator("[data-updated-stamp]")).toHaveCount(await widgets.count());
      await expect(page.locator("[data-updated-stamp]").first()).toHaveText(
        /Updated (just now|\d+ min ago)/,
      );
      // the count in the New leads widget is the database count
      expect(Number(await newLeadsText(page))).toBe(await dbNewLeads());
    }

    // A row added behind the page's back shows up after the manual refresh icon...
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${ADMIN}/admin/dashboard`);
    const before = Number(await newLeadsText(page));
    await insertLeads(1, "b");
    await page.getByRole("button", { name: /Refresh New leads/ }).click();
    await expect.poll(async () => Number(await newLeadsText(page))).toBe(before + 1);

    // ...and after the 60 second timer, with no click at all.
    await insertLeads(1, "c");
    await page.clock.fastForward(61_000);
    await expect
      .poll(async () => Number(await newLeadsText(page)), { timeout: 30_000 })
      .toBe(before + 2);
    expect(Number(await newLeadsText(page))).toBe(await dbNewLeads());
    issues.assertClean();
  });

  test("an empty widget shows an explicit zero state, not stale or sample numbers", async ({
    page,
  }) => {
    await loginAs(page, "super_admin");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${ADMIN}/admin/dashboard`);
    const queries = page.locator('section[data-widget="open_queries"]');
    const open = Number(
      (await q<{ c: string }>(`select count(*)::text as c from queries where status = 'open'`))[0]
        ?.c,
    );
    if (open === 0) await expect(queries).toContainText("Inbox zero");
    else await expect(queries.locator("ul li").first()).toBeVisible();
  });
});
