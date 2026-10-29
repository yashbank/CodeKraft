import { expect, test } from "@playwright/test";

import { ADMIN, expectNoOverflow, loginAs, q, ROLE_EMAILS, trackIssues } from "./helpers";

// P14-09: per-widget visual styles picked in Customise, stored with the layout, themed, accessible.
const widget = (key: string) => `section[data-widget="${key}"]`;

test.describe("P14-09 widget styles", () => {
  let uid = "";
  let before: { layout: unknown } | undefined;

  test.beforeAll(async () => {
    [{ id: uid } = { id: "" }] = await q<{ id: string }>(`select id from users where email = $1`, [
      ROLE_EMAILS.super_admin,
    ]);
    [before] = await q<{ layout: unknown }>(
      `select layout from dashboard_layouts where user_id = $1`,
      [uid],
    );
    // "Revenue by product" shows its empty state without a sale, so a fresh DB has no chart to
    // style. The ledger is append-only: seed one 1-rupee sale only when none exists (kept after).
    const [{ n = 0 } = {}] = await q<{ n: number }>(
      `select count(*)::int as n from ledger_entries where entry_type = 'sale' and order_item_id is not null`,
    );
    if (n === 0) {
      const [order] = await q<{ id: string }>(
        `insert into orders (order_no, user_id, currency, fx_rate_to_inr, subtotal_minor, total_minor, billing_snapshot)
         values ($1, (select id from users where email = $2), 'INR', '1', 100, 100, '{}'::jsonb) returning id`,
        [`P1409-${Date.now()}`, ROLE_EMAILS.super_admin],
      );
      const [item] = await q<{ id: string }>(
        `insert into order_items (order_id, product_id, description, unit_minor, total_minor)
         values ($1, (select id from products where slug = 'tradeflow'), 'P14-09 fixture', 100, 100) returning id`,
        [order!.id],
      );
      await q(
        `insert into ledger_entries (entry_type, party_type, order_id, order_item_id, amount_minor, currency, fx_rate_to_inr, amount_inr_minor, memo, created_by)
         values ('sale', 'customer', $1, $2, 100, 'INR', '1', 100, 'P14-09 fixture', $3)`,
        [order!.id, item!.id, uid],
      );
    }
  });

  test.afterAll(async () => {
    if (before)
      await q(`update dashboard_layouts set layout = $2::jsonb where user_id = $1`, [
        uid,
        JSON.stringify(before.layout),
      ]);
    else await q(`delete from dashboard_layouts where user_id = $1`, [uid]);
  });

  test("pick a stat + chart style, it renders, survives reload, themes + widths hold", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const issues = trackIssues(page);
    // Old array-of-ids format on purpose: it must still load, and the first save upgrades it.
    await q(
      `insert into dashboard_layouts (user_id, layout) values ($1, $2::jsonb)
       on conflict (user_id) do update set layout = excluded.layout`,
      [uid, JSON.stringify(["conversion_rate", "revenue_by_product", "chatbot_usage"])],
    );
    await loginAs(page, "super_admin");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${ADMIN}/admin/dashboard`);
    await expect(page.locator(widget("conversion_rate"))).toHaveAttribute("data-style", "plain", {
      timeout: 60_000,
    });
    await expect(page.locator(widget("revenue_by_product"))).toHaveAttribute(
      "data-style",
      "filled",
    );

    await page.getByRole("button", { name: "Customise" }).click();
    const dialog = page.getByRole("dialog");
    const pick = async (title: string, style: string) => {
      await dialog.getByRole("combobox", { name: `${title} style` }).click();
      await page.getByRole("option", { name: style, exact: true }).click();
    };
    // 6 styles offered per widget
    await dialog.getByRole("combobox", { name: "Conversion rate style" }).click();
    await expect(page.getByRole("option")).toHaveCount(6);
    await page.keyboard.press("Escape");
    await pick("Conversion rate", "big-number");
    await pick("Revenue by product", "striped");
    await pick("Chatbot usage vs limits", "segmented");
    await page.keyboard.press("Escape");

    const stat = page.locator(widget("conversion_rate"));
    const chart = page.locator(widget("revenue_by_product"));
    await expect(stat).toHaveAttribute("data-style", "big-number");
    await expect(chart).toHaveAttribute("data-style", "striped");
    await expect(chart.locator("pattern").first()).toBeAttached();
    await expect(page.locator(widget("chatbot_usage")).getByRole("meter").first()).toBeVisible();

    // stored with the layout (ids stay ids; styled entries become {i, style})
    await expect
      .poll(async () => {
        const [row] = await q<{ layout: Array<string | { i: string; style?: string }> }>(
          `select layout from dashboard_layouts where user_id = $1`,
          [uid],
        );
        return JSON.stringify(row?.layout);
      })
      .toContain('"style":"striped"');

    await page.reload();
    await expect(page.locator(widget("conversion_rate"))).toHaveAttribute(
      "data-style",
      "big-number",
      { timeout: 60_000 },
    );
    await expect(page.locator(widget("revenue_by_product"))).toHaveAttribute(
      "data-style",
      "striped",
    );
    await expect(page.locator(widget("chatbot_usage"))).toHaveAttribute("data-style", "segmented");

    // a11y: the chart keeps its text alternative + data table, the stat keeps its number
    const fig = page.locator(widget("revenue_by_product")).locator("figure");
    await expect(fig.locator("svg[aria-label]")).toHaveAttribute(
      "aria-label",
      /Revenue by product/,
    );
    expect(await fig.locator("table tbody tr").count()).toBeGreaterThan(0);
    expect(await page.locator(widget("conversion_rate")).innerText()).toMatch(/\d+ ?%/);

    // theme tokens: the chart paint follows the theme (dark default -> light), no hard-coded colour
    const bar = page.locator(widget("revenue_by_product")).locator("pattern rect").first();
    const dark = await bar.evaluate((el) => getComputedStyle(el).fill);
    await page.evaluate(() =>
      document.documentElement.setAttribute("data-theme", "light-editorial"),
    );
    const light = await bar.evaluate((el) => getComputedStyle(el).fill);
    expect(light).not.toBe(dark);
    await page.evaluate(() =>
      document.documentElement.setAttribute("data-theme", "dark-cinematic"),
    );
    await expectNoOverflow(page);

    // widths: laptop-only shell below 1024, no horizontal overflow anywhere
    for (const w of [375, 768, 1280]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(`${ADMIN}/admin/dashboard`);
      await expectNoOverflow(page);
      if (w < 1024) await expect(page.getByText(/designed for laptops/i)).toBeVisible();
      else await expect(page.locator(widget("revenue_by_product"))).toBeVisible();
    }
    issues.assertClean();
  });
});
