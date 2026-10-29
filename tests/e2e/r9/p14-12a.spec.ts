import fs from "node:fs";
import { expect, test } from "@playwright/test";

import { ADMIN, expectNoOverflow, loginAs, q, ROLE_EMAILS, SITE, trackIssues } from "./helpers";

// P14-12a: admin extras as super_admin at 1280, plus LaptopNotice at 375/768.
test.skip(({ isMobile }) => isMobile, "admin screens are laptop-only (LaptopNotice below lg)");

const widget = (key: string) => `section[data-widget="${key}"]`;

test.describe("P14-12a admin extras", () => {
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
  });

  test.afterAll(async () => {
    if (before)
      await q(`update dashboard_layouts set layout = $2::text::jsonb where user_id = $1`, [
        uid,
        JSON.stringify(before.layout),
      ]);
    else await q(`delete from dashboard_layouts where user_id = $1`, [uid]);
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, "super_admin");
  });

  test("1 search: palette finds orders and invoices; 8 ? opens the shortcuts list", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const issues = trackIssues(page);
    const [order] = await q<{ order_no: string }>(
      `select order_no from orders order by created_at desc limit 1`,
    );
    const [invoice] = await q<{ invoice_no: string }>(
      `select invoice_no from invoices order by issued_at desc limit 1`,
    );
    await page.goto(`${ADMIN}/admin/dashboard`);
    await expect(page.getByRole("heading", { name: "Dashboard" }).first()).toBeVisible({
      timeout: 60_000,
    });

    await page.keyboard.press("Control+k");
    const input = page.getByPlaceholder(/Search or jump to/);
    await expect(input).toBeVisible();
    if (order) {
      await input.fill(order.order_no);
      await expect(page.getByRole("option", { name: new RegExp(order.order_no) })).toBeVisible({
        timeout: 15_000,
      });
    }
    if (invoice) {
      await input.fill(invoice.invoice_no);
      const hit = page.getByRole("option", { name: new RegExp(invoice.invoice_no) });
      await expect(hit).toBeVisible({ timeout: 15_000 });
      await hit.click();
      await expect(page).toHaveURL(/\/admin\/finance\/invoices\//);
    } else {
      await page.keyboard.press("Escape");
    }

    // ? is ignored while typing, opens the sheet otherwise
    await page.goto(`${ADMIN}/admin/dashboard`);
    await expect(page.getByRole("heading", { name: "Dashboard" }).first()).toBeVisible();
    await page.keyboard.press("?");
    const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Open search and quick actions");
    await expect(sheet).toContainText("Collapse or expand the sidebar");
    issues.assertClean();
  });

  test("2 undo: deleting a saved view offers Undo that restores it", async ({ page }) => {
    const name = `p1412a-${Date.now().toString(36)}`;
    await page.goto(`${ADMIN}/admin/finance/ledger`);
    await page.getByRole("button", { name: /^Views/ }).click();
    await page.getByLabel("View name").fill(name);
    await page.getByRole("button", { name: /^Save/ }).click();
    const list = page.getByRole("list", { name: "Saved views" });
    await expect(list.getByText(name)).toBeVisible();
    await page.getByRole("button", { name: `Delete view ${name}` }).click();
    await expect(list.getByText(name)).toHaveCount(0);
    const toast = page.locator("[data-sonner-toast]", { hasText: `View “${name}” deleted` });
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Undo" }).click();
    // clicking the toast is an outside click, so the popover closes: reopen it to see the list
    await page.getByRole("button", { name: "Views (1)" }).click();
    await expect(list.getByText(name)).toBeVisible();
    await page.getByRole("button", { name: `Delete view ${name}` }).click(); // clean up
  });

  test("3 reorder: drag a dashboard widget and the order persists; buttons work too", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await q(
      `insert into dashboard_layouts (user_id, layout) values ($1, $2::text::jsonb)
       on conflict (user_id) do update set layout = excluded.layout`,
      [
        uid,
        JSON.stringify([
          { i: "conversion_rate", x: 0, y: 0, w: 12, h: 1, style: "outlined" },
          "new_leads",
          "open_queries",
        ]),
      ],
    );
    await page.goto(`${ADMIN}/admin/dashboard`);
    const order = () =>
      page
        .locator("section[data-widget]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("data-widget")));
    await expect
      .poll(order, { timeout: 60_000 })
      .toEqual(["conversion_rate", "new_leads", "open_queries"]);
    await page.getByRole("button", { name: "Edit layout" }).click();
    await page.locator(widget("open_queries")).dragTo(page.locator(widget("conversion_rate")));
    await expect.poll(order).toEqual(["open_queries", "conversion_rate", "new_leads"]);
    await expect
      .poll(async () => {
        const [row] = await q<{ layout: Array<{ i: string; style?: string }> }>(
          `select layout from dashboard_layouts where user_id = $1`,
          [uid],
        );
        return row?.layout.map((l) => `${l.i}${l.style ? `:${l.style}` : ""}`);
      })
      .toEqual(["open_queries", "conversion_rate:outlined", "new_leads"]);

    // keyboard path
    await page.getByRole("button", { name: "Move New leads earlier" }).click();
    await expect.poll(order).toEqual(["open_queries", "new_leads", "conversion_rate"]);
    // the save is a server action: reloading before it lands would read the previous order
    await expect
      .poll(async () => {
        const [row] = await q<{ layout: Array<{ i: string }> }>(
          `select layout from dashboard_layouts where user_id = $1`,
          [uid],
        );
        return row?.layout.map((l) => l.i);
      })
      .toEqual(["open_queries", "new_leads", "conversion_rate"]);
    await page.reload();
    await expect
      .poll(order, { timeout: 60_000 })
      .toEqual(["open_queries", "new_leads", "conversion_rate"]);
  });

  test("4 heatmap: weekday x hour widget, style switch, accessible", async ({ page }) => {
    test.setTimeout(180_000);
    await q(
      `insert into dashboard_layouts (user_id, layout) values ($1, $2::text::jsonb)
       on conflict (user_id) do update set layout = excluded.layout`,
      [uid, JSON.stringify(["orders_heatmap"])],
    );
    const recent = await q<{ n: string }>(
      `select count(*)::text as n from orders where created_at >= now() - interval '90 days'`,
    );
    const n = recent[0]?.n ?? "0";
    await page.goto(`${ADMIN}/admin/dashboard`);
    const w = page.locator(widget("orders_heatmap"));
    await expect(w).toHaveAttribute("data-style", "squares", { timeout: 60_000 });
    if (Number(n) > 0) {
      await expect(w.locator("[data-cell]")).toHaveCount(7 * 24);
      await expect(w.getByRole("img")).toHaveAttribute("aria-label", /busiest/);
      await expect(w.locator("table.sr-only")).toBeAttached();
    } else {
      await expect(w.getByText("No orders in the last 90 days")).toBeVisible();
    }
    await page.getByRole("button", { name: "Customise" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Orders by weekday and hour style" }).click();
    await expect(page.getByRole("option")).toHaveCount(6);
    await page.getByRole("option", { name: "circles", exact: true }).click();
    await expect(w).toHaveAttribute("data-style", "circles");
  });

  test("5 bulk: customers and orders tables show the action bar for selected rows", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(`${ADMIN}/admin/customers`);
    const all = page.getByRole("checkbox", { name: "Select all customers" });
    await expect(all).toBeVisible({ timeout: 60_000 });
    await all.click();
    const bar = page.getByTestId("bulk-bar");
    await expect(bar).toContainText(/\d+ selected/);
    await bar.getByRole("button", { name: "Suspend selected" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toContainText(/Suspend .*\?/);
    await dlg.getByRole("button", { name: "Cancel" }).click(); // never mutate shared data here
    await bar.getByRole("button", { name: "Clear" }).click();
    await expect(bar).toHaveCount(0);

    await page.goto(`${ADMIN}/admin/orders`);
    await page.getByRole("button", { name: /Pending payment/ }).click();
    const pick = page
      .getByRole("checkbox", { name: /^Select (?!all)/ })
      .and(page.locator(":enabled"));
    if ((await pick.count()) > 0) {
      await pick.first().click();
      await expect(page.getByTestId("bulk-bar")).toContainText("1 selected");
      await page.getByRole("button", { name: "Mark payments failed" }).click();
      await expect(page.getByRole("dialog")).toContainText("Mark payment failed");
      await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    }
  });

  test("6 timeline: order and customer detail show the activity timeline", async ({ page }) => {
    test.setTimeout(120_000);
    const [order] = await q<{ id: string }>(
      `select id from orders order by created_at desc limit 1`,
    );
    const [cust] = await q<{ id: string }>(
      `select u.id from users u join user_roles r on r.user_id = u.id where r.role_key = 'customer' limit 1`,
    );
    if (order) {
      await page.goto(`${ADMIN}/admin/orders/${order.id}`);
      await expect(
        page.getByTestId("activity-timeline").or(page.getByText("No events yet")),
      ).toBeVisible({ timeout: 60_000 });
    }
    if (cust) {
      await page.goto(`${ADMIN}/admin/customers/${cust.id}`);
      await page.getByRole("tab", { name: "Activity" }).click({ timeout: 60_000 });
      await expect(page.getByTestId("activity-timeline")).toBeVisible();
      await expect(page.getByTestId("activity-timeline")).toContainText(/account created/i);
    }
  });

  test("7 order alerts: polling endpoint + 'New order' toast", async ({ page }) => {
    test.setTimeout(120_000);
    const bad = await page.request.get(`${ADMIN}/api/admin/orders/alerts?since=nope`);
    expect(bad.status()).toBe(400);
    const res = await page.request.get(
      `${ADMIN}/api/admin/orders/alerts?since=${encodeURIComponent("2020-01-01T00:00:00Z")}`,
    );
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { ok: boolean; data: { count: number; latest: unknown[] } };
    expect(body.ok).toBe(true);
    expect(body.data.latest.length).toBeLessThanOrEqual(3);

    await page.route("**/api/admin/orders/alerts*", (route) =>
      route.fulfill({
        json: {
          ok: true,
          data: {
            serverTime: new Date().toISOString(),
            count: 1,
            latest: [{ id: "00000000-0000-4000-8000-000000000000", orderNo: "CK-E2E-0001" }],
          },
        },
      }),
    );
    await page.goto(`${ADMIN}/admin/dashboard`);
    await expect(page.getByRole("heading", { name: "Dashboard" }).first()).toBeVisible({
      timeout: 60_000,
    });
    // The poll hook attaches on hydration: nudge it until the toast shows.
    await expect(async () => {
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await expect(page.getByText("New order #CK-E2E-0001")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
  });

  test("8 account: ? opens the shortcuts list for a customer", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, "customer");
    await page.goto(`${SITE}/account`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press("?");
    const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Show this list");
    await expect(sheet).not.toContainText("Open search and quick actions");
  });

  test("9 settings: export has no secrets; import previews the diff, refuses secrets", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(`${ADMIN}/admin/settings`);
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      page.getByRole("button", { name: "Export", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("codekraft-settings.json");
    const file = JSON.parse(fs.readFileSync((await download.path()) as string, "utf8")) as {
      format: string;
      settings: Record<string, unknown>;
    };
    expect(file.format).toBe("codekraft.settings");
    expect(file.settings).not.toHaveProperty("razorpaySettings");
    expect(file.settings).not.toHaveProperty("bankDetails");

    await page.getByRole("button", { name: "Import", exact: true }).click();
    const dlg = page.getByRole("dialog");
    const upload = (settings: Record<string, unknown>) =>
      dlg.getByLabel("Settings file (.json)").setInputFiles({
        name: "s.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({ ...file, settings })),
      });

    await upload({ ...file.settings, siteName: "Preview Only Name" });
    await dlg.getByRole("button", { name: "Preview changes" }).click();
    await expect(dlg.getByTestId("settings-diff")).toContainText("siteName");
    await expect(dlg.getByTestId("settings-diff")).toContainText("Preview Only Name");

    await upload({ ...file.settings, razorpaySettings: { mode: "test" } });
    await dlg.getByRole("button", { name: "Preview changes" }).click();
    await expect(dlg.getByRole("alert")).toContainText(/Secrets can't be imported/);
    await dlg.getByRole("button", { name: "Cancel" }).click(); // nothing was written
  });

  test("LaptopNotice at 375/768, full screen at 1280, no overflow", async ({ page }) => {
    for (const url of [`${ADMIN}/admin/settings`, `${ADMIN}/admin/dashboard`]) {
      for (const w of [375, 768, 1280]) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(url);
        await expectNoOverflow(page);
        if (w < 1024 && url.endsWith("/settings"))
          await expect(page.getByText(/designed for laptops/i)).toBeVisible();
      }
    }
  });
});
