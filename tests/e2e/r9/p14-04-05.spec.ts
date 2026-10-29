/** P14-04 Settings → Email From + test send; P14-05 tab title + icons follow site name/logo. */
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, expectNoOverflow, loginAs, q, ROLE_EMAILS, SITE, WIDTHS } from "./helpers";

const TAG = String(Date.now() % 100000);
const FROM_NAME = `P14 Mail ${TAG}`;
const FROM_ADDR = `p14-${TAG}@example.test`;
const SITE_NAME = `P14 Brand ${TAG}`;
const LOGO = `https://example.test/p14-logo-${TAG}.png`;

async function openSettings(page: Page, section?: string) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${ADMIN}/admin/settings`);
  await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled({
    timeout: 60_000,
  });
  if (section) await page.getByRole("button", { name: section, exact: true }).click();
}

test.describe("P14-04 settings email From + test send", () => {
  test.setTimeout(180_000);

  test("saves From, validates, test send lands in the outbox with that From", async ({ page }) => {
    await loginAs(page, "super_admin");
    await openSettings(page, "Email & notifications");
    await expect(page.getByText(/verified sending\s+domain in Resend/)).toBeVisible();

    // Server-side validation surfaces on the field.
    await page.locator("#em-from-address").fill("not-an-email");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Settings saved")).toHaveCount(0);

    await page.locator("#em-from-name").fill(FROM_NAME);
    await page.locator("#em-from-address").fill(FROM_ADDR);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Send test email" }).click();
    await expect(page.getByText(/Test email (sent|queued)/)).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(
        async () =>
          (
            await q<{ from: string }>(
              `select payload->>'from' as "from" from email_outbox
               where template = 'test-email' and to_email = $1 order by created_at desc limit 1`,
              [ROLE_EMAILS.super_admin],
            )
          )[0]?.from,
        { timeout: 15_000 },
      )
      .toBe(`${FROM_NAME} <${FROM_ADDR}>`);
  });

  test.afterAll(async () => {
    await q(`delete from email_outbox where template = 'test-email' and payload->>'from' like $1`, [
      `${FROM_NAME}%`,
    ]);
    await q(`delete from site_settings where key in ('email_from_name', 'email_from_address')`);
  });
});

test.describe("P14-05 tab title + icons follow Settings", () => {
  test.setTimeout(240_000);

  test("site, admin and account titles contain the site name; icons use the logo", async ({
    page,
  }) => {
    const [name0] = await q<{ v: string }>(
      `select value #>> '{}' as v from site_settings where key = 'site_name'`,
    );
    // Raw jsonb text: the seeded logo can be JSON null, whose `#>> '{}'` is SQL NULL.
    const [logo0] = await q<{ v: string }>(
      `select value::text as v from site_settings where key = 'site_logo'`,
    );
    const originalName = name0?.v ?? "CodeKraft";
    const saveName = async (name: string) => {
      await openSettings(page);
      await page.locator("#st-site").fill(name);
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Settings saved")).toBeVisible({ timeout: 30_000 });
    };
    const expectBranding = async (url: string) => {
      await page.goto(url);
      await expect(page).toHaveTitle(new RegExp(SITE_NAME));
      await expect(page.locator('link[rel="icon"][href="' + LOGO + '"]')).toHaveCount(1);
      await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", LOGO);
    };

    try {
      await loginAs(page, "super_admin");
      // The logo is set directly; the settings save below revalidates the `settings` cache tag.
      await q(
        `insert into site_settings (key, value) values ('site_logo', to_jsonb($1::text))
         on conflict (key) do update set value = excluded.value`,
        [LOGO],
      );
      await saveName(SITE_NAME);

      await page.setViewportSize({ width: 1280, height: 900 });
      await expectBranding(`${ADMIN}/admin/dashboard`);

      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await expectBranding(`${SITE}/contact`);
        await expectNoOverflow(page);
      }

      await loginAs(page, "customer");
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await expectBranding(`${SITE}/account`);
        await expectNoOverflow(page);
      }
    } finally {
      if (logo0) {
        await q(`update site_settings set value = $1::text::jsonb where key = 'site_logo'`, [
          logo0.v,
        ]);
      } else {
        await q(`delete from site_settings where key = 'site_logo'`);
      }
      await loginAs(page, "super_admin");
      await saveName(originalName);
    }
  });
});
