/**
 * D17b: permanent customer delete + admins never listed as customers.
 * Seeds throw-away customers, deletes them from the list (single + bulk) and from the detail page,
 * and checks the admin accounts never show up in the Customers list at 375 / 768 / 1280.
 */
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, ROLE_EMAILS, atWidths, loginAs, q, trackIssues } from "./helpers";

const stamp = Date.now();
const mail = (n: string) => `d17b-${n}-${stamp}@example.test`;

async function seedCustomer(label: string) {
  const email = mail(label);
  const [row] = await q<{ id: string }>(
    `insert into users (email, name, email_verified) values ($1, $2, true) returning id`,
    [email, `D17b ${label}`],
  );
  return { id: row!.id, email, name: `D17b ${label}` };
}

const exists = async (id: string) =>
  (await q(`select 1 from users where id = $1`, [id])).length > 0;

async function typeAndConfirm(page: Page, phrase: string) {
  await page.getByLabel(new RegExp(`Type .* to confirm`)).fill(phrase);
  await page.getByRole("button", { name: "Delete permanently" }).last().click();
}

test("admins are not customers; super admin deletes customers from list and detail", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "admin customers is a laptop screen; 375/768 are covered on desktop");
  const issues = trackIssues(page);
  const a = await seedCustomer("single");
  const b = await seedCustomer("bulk1");
  const c = await seedCustomer("bulk2");
  const d = await seedCustomer("detail");

  await loginAs(page, "super_admin");

  // admins (super admin, admin, staff) never appear in the Customers list, at every width
  await atWidths(page, `${ADMIN}/admin/customers`, async () => {
    const body = page.locator("body");
    await expect(body).not.toContainText(ROLE_EMAILS.super_admin);
    await expect(body).not.toContainText(ROLE_EMAILS.admin);
    await expect(body).not.toContainText(ROLE_EMAILS.staff);
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${ADMIN}/admin/customers`);

  // single delete from the row menu: needs the typed email
  await expect(page.getByText(a.email)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: `Actions for ${a.name}` }).click();
  await page.getByRole("menuitem", { name: "Delete permanently" }).click();
  await page.getByLabel(/Type .* to confirm/).fill("wrong@example.test");
  await expect(page.getByRole("button", { name: "Delete permanently" }).last()).toBeDisabled();
  await typeAndConfirm(page, a.email);
  await expect(page.getByText(a.email)).toHaveCount(0, { timeout: 20_000 });
  expect(await exists(a.id)).toBe(false);

  // bulk delete: type DELETE
  await page.getByLabel(`Select ${b.name}`).check();
  await page.getByLabel(`Select ${c.name}`).check();
  await page.getByRole("button", { name: "Delete selected" }).click();
  await typeAndConfirm(page, "DELETE");
  await expect(page.getByText(b.email)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByText(c.email)).toHaveCount(0);
  expect(await exists(b.id)).toBe(false);
  expect(await exists(c.id)).toBe(false);

  // from the detail page (laptop-only screen) and back on the list
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${ADMIN}/admin/customers/${d.id}`);
  await page.getByRole("button", { name: "Delete permanently" }).first().click();
  await typeAndConfirm(page, d.email);
  await expect(page).toHaveURL(/\/admin\/customers$/, { timeout: 20_000 });
  expect(await exists(d.id)).toBe(false);

  // the address is free again
  await q(`insert into users (email, name, email_verified) values ($1, 'again', true)`, [a.email]);
  await q(`delete from users where email = $1`, [a.email]);

  issues.assertClean();
});
